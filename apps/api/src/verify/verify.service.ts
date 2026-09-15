import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

// Section 24/44: public verification endpoints. Deliberately return only
// the minimum safe fields - never address, phone, email, financial
// amounts, or internal remarks, even though the underlying records have
// that data.
@Injectable()
export class VerifyService {
  constructor(private readonly prisma: PrismaService) {}

  async verifyMember(memberId: string) {
    const member = await this.prisma.member.findFirst({
      where: { memberId, organizationId: DEFAULT_ORG_ID, deletedAt: null },
      include: { membershipType: true },
    });
    if (!member) return { verified: false };

    const status = !member.expiresAt
      ? "ACTIVE"
      : member.expiresAt.getTime() < Date.now()
        ? "EXPIRED"
        : "ACTIVE";

    return {
      verified: true,
      memberId: member.memberId,
      name: member.fullName,
      membershipType: member.membershipType.name,
      status,
      registrationDate: member.membershipDate.toISOString().slice(0, 10),
    };
  }

  async verifyCertificate(certificateNumber: string) {
    const member = await this.prisma.member.findFirst({
      where: { certificateNumber, organizationId: DEFAULT_ORG_ID, deletedAt: null },
      include: { membershipType: true },
    });
    if (!member) return { verified: false };
    return {
      verified: true,
      certificateNumber: member.certificateNumber,
      memberId: member.memberId,
      name: member.fullName,
      membershipType: member.membershipType.name,
      issuedDate: member.membershipDate.toISOString().slice(0, 10),
    };
  }

  async verifyReceipt(receiptNumber: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { receiptNumber, organizationId: DEFAULT_ORG_ID },
    });
    if (!payment) return { verified: false };
    // Section 44 explicitly excludes financial information from public
    // verification, so the amount is intentionally omitted here even
    // though it would normally be the most useful confirmation field.
    return {
      verified: true,
      receiptNumber: payment.receiptNumber,
      status: payment.status,
      date: (payment.verifiedAt ?? payment.createdAt).toISOString().slice(0, 10),
    };
  }

  // Addition beyond the spec's three named routes: lets a temporary
  // registration be checked the same way, since it's also a QR-bearing
  // document (Section 11) but wasn't listed under Section 24's three
  // examples.
  async verifyApplication(applicationNumber: string) {
    const application = await this.prisma.membershipApplication.findFirst({
      where: { applicationNumber, organizationId: DEFAULT_ORG_ID },
      include: { membershipType: true },
    });
    if (!application) return { verified: false };
    return {
      verified: true,
      applicationNumber: application.applicationNumber,
      name: application.fullName,
      membershipType: application.membershipType.name,
      status: application.status,
    };
  }
}
