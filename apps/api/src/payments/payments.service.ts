import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { GatewayRegistryService } from "./gateways/gateway-registry.service";
import { InitiatePaymentDto } from "./dto/initiate-payment.dto";
import { RecordOfflinePaymentDto } from "./dto/record-offline-payment.dto";
import { CreateMemberBillDto } from "./dto/create-member-bill.dto";
import { VerifyPaymentDto } from "./dto/verify-payment.dto";
import { NotificationsService } from "../notifications/notifications.service";
import type { PaymentStatus, Prisma } from "@prisma/client";

const PAYABLE_STATUSES = ["PAYMENT_PENDING", "PAYMENT_FAILED"]; // application statuses that may accept a new payment attempt

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
    private readonly gateways: GatewayRegistryService,
    private readonly notificationsService: NotificationsService,
  ) {}

  availableOnlineMethods() {
    return this.gateways.availableMethods();
  }

  // --- Online: initiate ------------------------------------------------

  async initiateOnline(organizationId: string, dto: InitiatePaymentDto, urls: { successUrl: string; failureUrl: string }) {
    const application = await this.getPayableApplication(organizationId, dto.applicationId);
    const provider = this.gateways.get(dto.method);
    if (!provider) throw new BadRequestException(`Unsupported payment method: ${dto.method}`);
    if (!provider.isConfigured()) {
      throw new BadRequestException(
        `${dto.method} is not yet configured for this organization. Please choose an offline payment method or contact the organization.`,
      );
    }

    const paymentNumber = await this.organizationsService.nextSequenceNumber(organizationId, "payment", "LA-PAY");

    const payment = await this.prisma.payment.create({
      data: {
        organizationId,
        paymentNumber,
        applicationId: application.id,
        amount: application.membershipFee,
        method: dto.method,
        status: "PENDING",
      },
    });

    const checkout = provider.buildCheckout({
      paymentNumber: payment.paymentNumber,
      amount: application.membershipFee.toString(),
      successUrl: urls.successUrl,
      failureUrl: urls.failureUrl,
    });

    await this.prisma.paymentTransaction.create({
      data: { paymentId: payment.id, direction: "initiate", rawPayload: checkout as any },
    });

    return { payment, checkout };
  }

  // --- Online: server-side verification (never trust the redirect alone) ---

  async verifyOnline(organizationId: string, paymentId: string, gatewayReference: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, organizationId },
      include: { application: true },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status === "PAID" || payment.status === "MANUALLY_VERIFIED") return payment; // idempotent

    const provider = this.gateways.get(payment.method);
    if (!provider) throw new BadRequestException(`${payment.method} has no online verification provider`);

    const result = await provider.verifyTransaction(gatewayReference);

    await this.prisma.paymentTransaction.create({
      data: { paymentId: payment.id, direction: "verify", rawPayload: result.rawPayload as any },
    });

    const updatedPayment = await this.prisma.$transaction(async (tx) => {
      if (result.verified) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "PAID", gatewayReference: result.gatewayReference, verifiedAt: new Date() },
        });
        await this.markApplicationPaymentSuccess(tx, payment);
      } else {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "FAILED", failureReason: result.failureReason ?? "Verification failed" },
        });
        await this.markApplicationPaymentFailed(tx, payment.applicationId!, result.failureReason);
      }
      return tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
    });

    // Fired after the transaction commits, using the main client - a
    // notification for a payment that got rolled back would be worse than
    // a notification arriving a moment late.
    if (result.verified) {
      await this.notificationsService.notifyByPermission(organizationId, "applications.review", {
        type: "payment_success",
        title: "Payment verified",
        message: `Payment for ${payment.application!.fullName} (${payment.application!.applicationNumber}) is verified and queued for review`,
        link: `/dashboard/applications/${payment.applicationId}`,
        relatedRecordId: payment.id,
      });
    } else {
      await this.notificationsService.notifyByPermission(organizationId, "payments.verify", {
        type: "payment_failed",
        title: "Online payment failed",
        message: `${payment.method} payment for ${payment.application!.fullName} (${payment.application!.applicationNumber}) failed verification`,
        link: `/dashboard/applications/${payment.applicationId}`,
        relatedRecordId: payment.id,
      });
    }

    return updatedPayment;
  }

  // --- Offline: record + manual verification ----------------------------

  async recordOffline(organizationId: string, recordedById: string, dto: RecordOfflinePaymentDto) {
    const application = await this.getPayableApplication(organizationId, dto.applicationId);

    const paymentNumber = await this.organizationsService.nextSequenceNumber(organizationId, "payment", "LA-PAY");

    return this.prisma.payment.create({
      data: {
        organizationId,
        paymentNumber,
        applicationId: application.id,
        amount: application.membershipFee,
        method: dto.method,
        status: "PENDING",
        recordedById,
        offlineReference: dto.offlineReference,
        remarks: dto.remarks,
      },
    });
  }

  async verifyOffline(organizationId: string, verifierId: string, paymentId: string, dto: VerifyPaymentDto) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, organizationId },
      include: { application: true },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    if (["ESEWA", "KHALTI", "CONNECTIPS"].includes(payment.method)) {
      throw new BadRequestException("Online payments are verified automatically, not manually");
    }
    if (payment.status === "MANUALLY_VERIFIED") return payment;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "MANUALLY_VERIFIED",
          verifiedById: verifierId,
          verifiedAt: new Date(),
          remarks: dto.remarks ?? payment.remarks,
        },
      });
      await this.markApplicationPaymentSuccess(tx, payment);
      return result;
    });

    await this.notificationsService.notifyByPermission(organizationId, "applications.review", {
      type: "payment_success",
      title: "Payment verified",
      message: `Payment for ${payment.application!.fullName} (${payment.application!.applicationNumber}) is verified and queued for review`,
      link: `/dashboard/applications/${payment.applicationId}`,
      relatedRecordId: payment.id,
    });

    return updated;
  }

  async refund(organizationId: string, actorId: string, paymentId: string, remarks?: string) {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, organizationId } });
    if (!payment) throw new NotFoundException("Payment not found");
    if (!["PAID", "MANUALLY_VERIFIED"].includes(payment.status)) {
      throw new BadRequestException("Only a paid/verified payment can be refunded");
    }
    // Section 48: financial records are never deleted - a refund is a new
    // status on the existing row, always leaving the original payment
    // trail intact.
    return this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: "REFUNDED", verifiedById: actorId, remarks: remarks ?? payment.remarks },
    });
  }

  findAll(organizationId: string, status?: PaymentStatus) {
    return this.prisma.payment.findMany({
      where: { organizationId, status },
      include: {
        application: { select: { id: true, applicationNumber: true, fullName: true } },
        member: { select: { id: true, memberId: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(organizationId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, organizationId },
      include: {
        application: { select: { id: true, applicationNumber: true, fullName: true } },
        member: { select: { id: true, memberId: true, fullName: true } },
        recordedBy: { select: { fullName: true } },
        verifiedBy: { select: { fullName: true } },
        transactions: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    return payment;
  }

  // --- Billing for a member with no online application on file ----------
  // (e.g. added directly via "Add Member") - parallels recordOffline()
  // above, which requires an application.

  async createMemberBill(organizationId: string, recordedById: string, dto: CreateMemberBillDto) {
    const member = await this.prisma.member.findFirst({
      where: { id: dto.memberId, organizationId, deletedAt: null },
    });
    if (!member) throw new NotFoundException("Member not found");

    const paymentNumber = await this.organizationsService.nextSequenceNumber(organizationId, "payment", "LA-PAY");

    return this.prisma.payment.create({
      data: {
        organizationId,
        paymentNumber,
        memberId: member.id,
        amount: dto.amount ?? member.membershipPrice,
        method: dto.method,
        status: "PENDING",
        recordedById,
        offlineReference: dto.offlineReference,
        remarks: dto.remarks,
      },
    });
  }

  async verifyMemberBill(organizationId: string, verifierId: string, paymentId: string, dto: VerifyPaymentDto) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, organizationId },
      include: { member: true },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    if (!payment.memberId) throw new BadRequestException("This payment belongs to an application, not a direct member bill");
    if (payment.status === "MANUALLY_VERIFIED") return payment;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "MANUALLY_VERIFIED",
          verifiedById: verifierId,
          verifiedAt: new Date(),
          remarks: dto.remarks ?? payment.remarks,
        },
      });
      await this.markMemberPaymentSuccess(tx, payment);
      return result;
    });

    await this.notificationsService.notifyByPermission(organizationId, "finance.approve", {
      type: "payment_success",
      title: "Bill paid",
      message: `${payment.member!.fullName} (${payment.member!.memberId}) paid their bill`,
      link: `/dashboard/members`,
      relatedRecordId: payment.id,
    });

    return updated;
  }

  billsForMember(organizationId: string, memberId: string) {
    return this.prisma.payment.findMany({
      where: { organizationId, memberId },
      orderBy: { createdAt: "desc" },
    });
  }

  // --- shared helpers -----------------------------------------------------

  private async getPayableApplication(organizationId: string, applicationId: string) {
    const application = await this.prisma.membershipApplication.findFirst({
      where: { id: applicationId, organizationId },
    });
    if (!application) throw new NotFoundException("Application not found");
    if (!PAYABLE_STATUSES.includes(application.status)) {
      throw new BadRequestException(
        `This application is not awaiting payment (current status: ${application.status}).`,
      );
    }
    return application;
  }

  private async markApplicationPaymentSuccess(tx: Prisma.TransactionClient, payment: { id: string; applicationId: string | null; amount: Prisma.Decimal; organizationId: string }) {
    // This method only ever runs for application-based payments (both call
    // sites are in the application-linked verify flows) - member-direct
    // bills use markMemberPaymentSuccess instead. Guard rather than assume,
    // since Payment.applicationId is nullable at the type level now that
    // direct member billing exists.
    if (!payment.applicationId) return;
    const applicationId = payment.applicationId;
    const application = await tx.membershipApplication.findUniqueOrThrow({ where: { id: applicationId } });
    await tx.membershipApplication.update({
      where: { id: applicationId },
      data: {
        status: "UNDER_REVIEW",
        statusHistory: {
          create: [
            { fromStatus: application.status, toStatus: "PAYMENT_SUCCESS", remarks: "Payment verified" },
            { fromStatus: "PAYMENT_SUCCESS", toStatus: "UNDER_REVIEW", remarks: "Automatically queued for review" },
          ],
        },
      },
    });

    // Section 11: "After successful payment, generate a temporary
    // registration." Only the number is issued here (transaction-safe,
    // idempotent); the PDF itself is rendered on demand by DocumentsModule
    // from this row, so payments.service.ts doesn't need to know anything
    // about PDF generation.
    const existingRegistration = await tx.temporaryRegistration.findUnique({ where: { applicationId } });
    if (!existingRegistration) {
      const registrationNumber = await this.organizationsService.nextSequenceNumber(
        application.organizationId,
        "temporary_registration",
        "LA-TMP",
      );
      await tx.temporaryRegistration.create({
        data: { organizationId: application.organizationId, applicationId, registrationNumber },
      });
    }

    // Section 18: "Membership payments should automatically appear as
    // income after successful verification." relatedPaymentId is unique,
    // so this is idempotent if verification is ever triggered twice.
    const existingIncome = await tx.income.findUnique({ where: { relatedPaymentId: payment.id } });
    if (!existingIncome) {
      const membershipCategory = await tx.incomeCategory.findFirst({
        where: { organizationId: payment.organizationId, name: "Membership" },
      });
      if (membershipCategory) {
        const incomeNumber = await this.organizationsService.nextSequenceNumber(
          payment.organizationId,
          "income",
          "LA-INC",
        );
        await tx.income.create({
          data: {
            organizationId: payment.organizationId,
            incomeNumber,
            categoryId: membershipCategory.id,
            description: `Membership payment - ${application.fullName} (${application.applicationNumber})`,
            amount: payment.amount,
            relatedPaymentId: payment.id,
            relatedMemberId: application.memberId,
            // Auto-approved: the payment verification itself is the
            // approval event for this income - a human already verified
            // the payment (accountant for offline, the gateway for
            // online); there's nothing further to approve.
            approvedAt: new Date(),
          },
        });
      }
      // If the "Membership" category is missing (e.g. deleted by an
      // admin), payment verification still succeeds - it just doesn't
      // silently invent a category. The gap would show up in a finance
      // reconciliation, which is preferable to guessing.
    }
  }

  private async markMemberPaymentSuccess(tx: Prisma.TransactionClient, payment: { id: string; memberId: string | null; amount: Prisma.Decimal; organizationId: string }) {
    if (!payment.memberId) return;
    const member = await tx.member.findUniqueOrThrow({ where: { id: payment.memberId } });

    // Same idempotent auto-income creation as markApplicationPaymentSuccess,
    // just without any application/temporary-registration side effects -
    // there is no application in this flow (Section 18 still applies:
    // membership payments auto-appear as income either way).
    const existingIncome = await tx.income.findUnique({ where: { relatedPaymentId: payment.id } });
    if (!existingIncome) {
      const membershipCategory = await tx.incomeCategory.findFirst({
        where: { organizationId: payment.organizationId, name: "Membership" },
      });
      if (membershipCategory) {
        const incomeNumber = await this.organizationsService.nextSequenceNumber(
          payment.organizationId,
          "income",
          "LA-INC",
        );
        await tx.income.create({
          data: {
            organizationId: payment.organizationId,
            incomeNumber,
            categoryId: membershipCategory.id,
            description: `Membership bill - ${member.fullName} (${member.memberId})`,
            amount: payment.amount,
            relatedPaymentId: payment.id,
            relatedMemberId: member.id,
            approvedAt: new Date(),
          },
        });
      }
    }
  }

  private async markApplicationPaymentFailed(tx: Prisma.TransactionClient, applicationId: string, reason?: string) {
    const application = await tx.membershipApplication.findUniqueOrThrow({ where: { id: applicationId } });
    await tx.membershipApplication.update({
      where: { id: applicationId },
      data: {
        status: "PAYMENT_FAILED",
        statusHistory: {
          create: { fromStatus: application.status, toStatus: "PAYMENT_FAILED", remarks: reason ?? "Payment verification failed" },
        },
      },
    });
  }
}
