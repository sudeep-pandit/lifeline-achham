import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { CreateApplicationDto } from "./dto/create-application.dto";
import { ReviewApplicationDto } from "./dto/review-application.dto";
import { NotificationsService } from "../notifications/notifications.service";
import type { ApplicationStatus } from "@prisma/client";

// Phase 3 wires payments in: submit() now moves an application to
// PAYMENT_PENDING immediately, and review()'s APPROVE branch requires a
// verified Payment before it will create a Member (Section 48, rule 4:
// "Failed payments must not activate membership").
@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async submit(organizationId: string, dto: CreateApplicationDto) {
    const membershipType = await this.prisma.membershipType.findFirst({
      where: { id: dto.membershipTypeId, organizationId, isActive: true },
    });
    if (!membershipType) throw new BadRequestException("Selected membership type is not available");

    const applicationNumber = await this.organizationsService.nextSequenceNumber(
      organizationId,
      "application",
      "LA-APP",
    );

    const application = await this.prisma.membershipApplication.create({
      data: {
        organizationId,
        applicationNumber,
        fullName: dto.fullName,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        districtId: dto.districtId,
        municipalityId: dto.municipalityId,
        wardNo: dto.wardNo,
        tole: dto.tole,
        email: dto.email,
        mobile: dto.mobile,
        countryCode: dto.countryCode ?? "+977",
        socialLinks: dto.socialLinks as any,
        membershipTypeId: dto.membershipTypeId,
        membershipFee: membershipType.price,
        status: "PAYMENT_PENDING",
        statusHistory: {
          create: [
            { toStatus: "SUBMITTED", remarks: "Application submitted" },
            { fromStatus: "SUBMITTED", toStatus: "PAYMENT_PENDING", remarks: "Awaiting payment" },
          ],
        },
      },
    });

    // Section 25: notify everyone who reviews applications - fires after
    // creation succeeds, never blocking the applicant's response on it.
    await this.notificationsService.notifyByPermission(organizationId, "applications.review", {
      type: "new_application",
      title: "New membership application",
      message: `${application.fullName} applied for ${membershipType.name} (${application.applicationNumber})`,
      link: `/dashboard/applications/${application.id}`,
      relatedRecordId: application.id,
    });

    return application;
  }

  // Public: lets an applicant check their own status by application number,
  // without exposing the full admin record (Section 44).
  async trackByNumber(organizationId: string, applicationNumber: string) {
    const application = await this.prisma.membershipApplication.findFirst({
      where: { organizationId, applicationNumber },
      include: { membershipType: true },
    });
    if (!application) throw new NotFoundException("No application found with that number");
    return {
      applicationNumber: application.applicationNumber,
      status: application.status,
      membershipType: application.membershipType.name,
      submittedAt: application.createdAt,
    };
  }

  findAll(organizationId: string, status?: ApplicationStatus) {
    return this.prisma.membershipApplication.findMany({
      where: { organizationId, status },
      include: { membershipType: true, district: true, municipality: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(organizationId: string, id: string) {
    const application = await this.prisma.membershipApplication.findFirst({
      where: { id, organizationId },
      include: {
        membershipType: true,
        district: true,
        municipality: true,
        reviewedBy: { select: { fullName: true } },
        statusHistory: {
          include: { changedBy: { select: { fullName: true } } },
          orderBy: { createdAt: "asc" },
        },
        member: true,
        payments: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!application) throw new NotFoundException("Application not found");
    return application;
  }

  // Section 12: Approve / Reject / Request Correction. Approval atomically
  // creates the Member record with a numbering-engine-issued Member ID
  // (Section 6: "Never allow duplicate IDs") inside the same transaction
  // as the status change, so a failure never leaves an orphaned Member or
  // an application stuck mid-approval.
  async review(organizationId: string, id: string, reviewerId: string, dto: ReviewApplicationDto) {
    const application = await this.prisma.membershipApplication.findFirst({
      where: { id, organizationId },
      include: { membershipType: true },
    });
    if (!application) throw new NotFoundException("Application not found");

    if (["APPROVED", "REJECTED", "CANCELLED"].includes(application.status)) {
      throw new BadRequestException(`Application is already ${application.status.toLowerCase()}`);
    }

    if (dto.action === "REQUEST_CORRECTION") {
      // Only bounce all the way back to SUBMITTED if no payment has been
      // made yet - once a verified payment exists (status reached
      // UNDER_REVIEW), reverting would strand that payment against a
      // resubmission flow this phase doesn't have; the correction is
      // instead logged as a remark and staff follow up with the applicant
      // directly without losing the payment-gated progress.
      const noPaymentYet = ["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(application.status);
      const nextStatus = noPaymentYet ? "SUBMITTED" : application.status;
      return this.prisma.membershipApplication.update({
        where: { id },
        data: {
          status: nextStatus,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          reviewRemarks: dto.remarks,
          statusHistory: {
            create: { fromStatus: application.status, toStatus: nextStatus, changedById: reviewerId, remarks: dto.remarks ?? "Correction requested" },
          },
        },
      });
    }

    if (dto.action === "REJECT") {
      return this.prisma.membershipApplication.update({
        where: { id },
        data: {
          status: "REJECTED",
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          reviewRemarks: dto.remarks,
          statusHistory: {
            create: { fromStatus: application.status, toStatus: "REJECTED", changedById: reviewerId, remarks: dto.remarks },
          },
        },
      });
    }

    // APPROVE - requires a verified payment on file (Section 48, rule 4).
    const verifiedPayment = await this.prisma.payment.findFirst({
      where: { applicationId: id, status: { in: ["PAID", "MANUALLY_VERIFIED"] } },
    });
    if (!verifiedPayment) {
      throw new BadRequestException(
        "This application cannot be approved until it has a verified payment on file.",
      );
    }

    // Note: nextSequenceNumber runs its own short transaction to claim the
    // next Member ID atomically (see OrganizationsService), separate from
    // the outer transaction below. If the outer transaction later fails,
    // the claimed number is simply skipped (a gap), never reused - gaps in
    // a sequence are fine, duplicates are not (Section 6).
    return this.prisma.$transaction(async (tx) => {
      const memberId = await this.organizationsService.nextSequenceNumber(organizationId, "membership_id", "LA-LM");

      const expiresAt = application.membershipType.durationDays
        ? new Date(Date.now() + application.membershipType.durationDays * 24 * 60 * 60 * 1000)
        : null;

      const member = await tx.member.create({
        data: {
          organizationId,
          memberId,
          fullName: application.fullName,
          dateOfBirth: application.dateOfBirth,
          gender: application.gender,
          districtId: application.districtId,
          municipalityId: application.municipalityId,
          wardNo: application.wardNo,
          tole: application.tole,
          email: application.email,
          mobile: application.mobile,
          countryCode: application.countryCode,
          socialLinks: application.socialLinks as any,
          membershipTypeId: application.membershipTypeId,
          membershipDate: new Date(),
          membershipPrice: application.membershipFee,
          expiresAt,
          approvalStatus: "APPROVED",
          approvedById: reviewerId,
          approvedAt: new Date(),
          remarks: dto.remarks,
        },
      });

      // Backfill the income entry auto-created at payment verification
      // (Section 18) with the member it ultimately funded - it couldn't be
      // linked at verification time because the Member didn't exist yet.
      await tx.income.updateMany({
        where: { relatedPaymentId: verifiedPayment.id },
        data: { relatedMemberId: member.id },
      });

      return tx.membershipApplication.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          reviewRemarks: dto.remarks,
          memberId: member.id,
          statusHistory: {
            create: { fromStatus: application.status, toStatus: "APPROVED", changedById: reviewerId, remarks: dto.remarks },
          },
        },
        include: { member: true },
      });
    }).then(async (updated) => {
      await this.notificationsService.notifyByPermission(organizationId, "members.view", {
        type: "membership_approved",
        title: "New member approved",
        message: `${application.fullName} is now a member (${updated.member?.memberId})`,
        link: `/dashboard/members`,
        relatedRecordId: id,
      });
      return updated;
    });
  }
}
