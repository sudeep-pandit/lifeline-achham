import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PDFDocument } from "pdf-lib";
import { PrismaService } from "../../prisma/prisma.service";
import { OrganizationsService } from "../../organizations/organizations.service";
import { PdfFontService } from "../pdf/pdf-font.service";
import { generateQrPng } from "../pdf/qr.util";
import { A4_PORTRAIT, drawFooter, drawHeader, drawSignatureBlock, drawWatermark, embedQr, MUTED, NAVY } from "../pdf/pdf-layout.util";
import { ConfigService } from "@nestjs/config";

const RECEIPTABLE_STATUSES = ["PAID", "MANUALLY_VERIFIED"];

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
    private readonly fonts: PdfFontService,
    private readonly config: ConfigService,
  ) {}

  private async getPayment(organizationId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, organizationId },
      include: { application: true, member: true },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    if (!RECEIPTABLE_STATUSES.includes(payment.status)) {
      throw new BadRequestException("A receipt can only be issued for a paid / manually verified payment.");
    }
    return payment;
  }

  private async ensureReceiptNumber(organizationId: string, paymentId: string): Promise<string> {
    const payment = await this.getPayment(organizationId, paymentId);
    if (payment.receiptNumber) return payment.receiptNumber;
    const receiptNumber = await this.organizationsService.nextSequenceNumber(organizationId, "receipt", "LA-RCP");
    await this.prisma.payment.update({ where: { id: paymentId }, data: { receiptNumber } });
    return receiptNumber;
  }

  // Section 15: A4 portrait receipt. Section 16 (multiple-per-page layouts)
  // is left for a follow-up increment - see docs/DATABASE_PLAN.md.
  async generatePdf(organizationId: string, paymentId: string): Promise<Uint8Array> {
    const receiptNumber = await this.ensureReceiptNumber(organizationId, paymentId);
    const payment = await this.getPayment(organizationId, paymentId);
    const settings = await this.prisma.organizationSettings.findUnique({ where: { organizationId } });
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    const webUrl = this.config.get<string>("webUrl");

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage(A4_PORTRAIT);
    const font = await this.fonts.embedBodyFont(pdfDoc);
    const boldFont = await this.fonts.embedBoldFont(pdfDoc);

    if (settings?.watermarkEnabled) {
      drawWatermark(page, { text: settings.watermarkText, font: boldFont, opacity: settings.watermarkOpacity });
    }

    drawHeader(page, { orgName: org?.name ?? "Lifeline Achham", documentTitle: "PAYMENT RECEIPT", font, boldFont });

    let y = 730;
    const line = (label: string, value: string) => {
      page.drawText(label, { x: 40, y, size: 10, font, color: MUTED });
      page.drawText(value, { x: 220, y, size: 11, font: boldFont, color: NAVY });
      y -= 22;
    };

    line("Receipt No.", receiptNumber);
    line("Date", (payment.verifiedAt ?? payment.createdAt).toLocaleDateString());
    if (settings?.panVatNumber) line("PAN/VAT", settings.panVatNumber);
    if (payment.application) {
      line("Customer Name", payment.application.fullName);
      line("Application No.", payment.application.applicationNumber);
    } else if (payment.member) {
      line("Customer Name", payment.member.fullName);
      line("Member ID", payment.member.memberId);
    }

    y -= 10;
    page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: MUTED });
    y -= 24;

    // Bill table
    page.drawText("S.N.", { x: 40, y, size: 9, font: boldFont, color: NAVY });
    page.drawText("Particulars", { x: 90, y, size: 9, font: boldFont, color: NAVY });
    page.drawText(`Amount (${payment.currency})`, { x: 450, y, size: 9, font: boldFont, color: NAVY });
    y -= 18;
    page.drawText("1", { x: 40, y, size: 10, font, color: NAVY });
    page.drawText(`${payment.method.replace(/_/g, " ")} - Membership Payment`, { x: 90, y, size: 10, font, color: NAVY });
    page.drawText(payment.amount.toString(), { x: 450, y, size: 10, font, color: NAVY });
    y -= 24;
    page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.5, color: MUTED });
    y -= 20;

    page.drawText("Total", { x: 90, y, size: 10, font: boldFont, color: NAVY });
    page.drawText(`${payment.currency} ${payment.amount.toString()}`, { x: 450, y, size: 10, font: boldFont, color: NAVY });

    y -= 40;
    line("Payment Method", payment.method.replace(/_/g, " "));
    if (payment.gatewayReference) line("Transaction ID", payment.gatewayReference);
    if (payment.offlineReference) line("Reference No.", payment.offlineReference);

    const qrPng = await generateQrPng(`${webUrl}/verify/receipt/${receiptNumber}`);
    await embedQr(pdfDoc, page, qrPng, { x: 460, y: 100, size: 80 });
    drawSignatureBlock(page, { x: 60, y: 100, font, label: "Authorized Signature" });

    drawFooter(page, { font, pageNumber: 1, totalPages: 1, generatedAt: new Date() });

    return pdfDoc.save();
  }
}
