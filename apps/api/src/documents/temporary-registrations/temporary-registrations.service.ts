import { Injectable, NotFoundException } from "@nestjs/common";
import { PDFDocument } from "pdf-lib";
import { PrismaService } from "../../prisma/prisma.service";
import { PdfFontService } from "../pdf/pdf-font.service";
import { generateQrPng } from "../pdf/qr.util";
import { A4_PORTRAIT, drawFooter, drawHeader, drawSignatureBlock, drawWatermark, embedQr, MUTED, NAVY, CRIMSON } from "../pdf/pdf-layout.util";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class TemporaryRegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fonts: PdfFontService,
    private readonly config: ConfigService,
  ) {}

  async findByApplication(organizationId: string, applicationId: string) {
    const record = await this.prisma.temporaryRegistration.findFirst({
      where: { applicationId, organizationId },
      include: { application: { include: { membershipType: true } } },
    });
    if (!record) {
      throw new NotFoundException(
        "No temporary registration on file yet - it is issued automatically once payment is verified.",
      );
    }
    return record;
  }

  async findByApplicationNumber(organizationId: string, applicationNumber: string) {
    const application = await this.prisma.membershipApplication.findFirst({
      where: { organizationId, applicationNumber },
    });
    if (!application) throw new NotFoundException("Application not found");
    return this.findByApplication(organizationId, application.id);
  }

  // Section 11: A4 portrait, must clearly state it is temporary. Section 17:
  // watermark. Section 24: QR verification.
  async generatePdf(organizationId: string, applicationId: string): Promise<Uint8Array> {
    const record = await this.findByApplication(organizationId, applicationId);
    const settings = await this.prisma.organizationSettings.findUnique({ where: { organizationId } });
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage(A4_PORTRAIT);
    const font = await this.fonts.embedBodyFont(pdfDoc);
    const boldFont = await this.fonts.embedBoldFont(pdfDoc);

    if (settings?.watermarkEnabled) {
      drawWatermark(page, { text: settings.watermarkText, font: boldFont, opacity: settings.watermarkOpacity });
    }

    drawHeader(page, {
      orgName: org?.name ?? "Lifeline Achham",
      documentTitle: "TEMPORARY MEMBERSHIP REGISTRATION",
      font,
      boldFont,
    });

    const { application } = record;
    let y = 730;
    const line = (label: string, value: string) => {
      page.drawText(label, { x: 40, y, size: 10, font, color: MUTED });
      page.drawText(value, { x: 220, y, size: 11, font: boldFont, color: NAVY });
      y -= 26;
    };

    line("Temporary Registration No.", record.registrationNumber);
    line("Application No.", application.applicationNumber);
    line("Applicant Name", application.fullName);
    line("Membership Type", application.membershipType.name);
    line("Registration Date", record.issuedAt.toLocaleDateString());
    line("Payment Status", "Verified");
    line("Amount Paid", `${settings?.currency ?? "NPR"} ${application.membershipFee.toString()}`);

    y -= 20;
    page.drawRectangle({ x: 40, y: y - 60, width: 515, height: 60, color: undefined, borderColor: CRIMSON, borderWidth: 1 });
    page.drawText(
      "This document is issued for temporary registration purposes only and shall remain valid until",
      { x: 50, y: y - 22, size: 9, font, color: NAVY },
    );
    page.drawText(
      "the official Membership Card and Certificate are printed/issued.",
      { x: 50, y: y - 36, size: 9, font, color: NAVY },
    );

    const webUrl = this.config.get<string>("webUrl");
    const qrPng = await generateQrPng(`${webUrl}/verify/application/${application.applicationNumber}`);
    await embedQr(pdfDoc, page, qrPng, { x: 440, y: 60, size: 90 });

    drawSignatureBlock(page, { x: 60, y: 100, font, label: "Authorized Signature" });
    drawFooter(page, { font, pageNumber: 1, totalPages: 1, generatedAt: new Date() });

    return pdfDoc.save();
  }
}
