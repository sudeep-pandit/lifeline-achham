import { Injectable, NotFoundException } from "@nestjs/common";
import { PDFDocument, rgb } from "pdf-lib";
import { PrismaService } from "../../prisma/prisma.service";
import { OrganizationsService } from "../../organizations/organizations.service";
import { PdfFontService } from "../pdf/pdf-font.service";
import { generateQrPng } from "../pdf/qr.util";
import { A4_LANDSCAPE, drawFooter, drawSignatureBlock, drawWatermark, embedQr, MUTED, NAVY, CRIMSON } from "../pdf/pdf-layout.util";
import { renderTemplateSide, type ResolvedFieldData } from "../pdf/template-renderer.util";
import { DocumentTemplatesService } from "../../document-templates/document-templates.service";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
    private readonly fonts: PdfFontService,
    private readonly templatesService: DocumentTemplatesService,
    private readonly config: ConfigService,
  ) {}

  private async getMember(organizationId: string, memberId: string) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, organizationId, deletedAt: null },
      include: { membershipType: true },
    });
    if (!member) throw new NotFoundException("Member not found");
    return member;
  }

  private async ensureCertificateNumber(organizationId: string, memberId: string): Promise<string> {
    const member = await this.getMember(organizationId, memberId);
    if (member.certificateNumber) return member.certificateNumber;
    const certificateNumber = await this.organizationsService.nextSequenceNumber(organizationId, "certificate", "LA-CERT");
    await this.prisma.member.update({ where: { id: memberId }, data: { certificateNumber } });
    return certificateNumber;
  }

  // Section 14: A4 landscape, professional/print-ready, QR verification,
  // watermark. Uses the org's default CERTIFICATE template if one has been
  // designed; otherwise the built-in layout below, so generation always
  // works even before anyone opens the designer.
  async generatePdf(organizationId: string, memberId: string, templateId?: string): Promise<Uint8Array> {
    const certificateNumber = await this.ensureCertificateNumber(organizationId, memberId);
    const member = await this.getMember(organizationId, memberId);
    const webUrl = this.config.get<string>("webUrl");
    const qrPng = await generateQrPng(`${webUrl}/verify/certificate/${certificateNumber}`);

    const template = templateId
      ? await this.templatesService.findOne(organizationId, templateId)
      : await this.templatesService.findDefault(organizationId, "CERTIFICATE");

    if (template) {
      return this.generateFromTemplate(organizationId, member, certificateNumber, qrPng, template);
    }
    return this.generateDefaultDesign(organizationId, member, certificateNumber, qrPng);
  }

  private async generateFromTemplate(
    organizationId: string,
    member: Awaited<ReturnType<typeof this.getMember>>,
    certificateNumber: string,
    qrPng: Uint8Array,
    template: { backgroundColor: string; frontLayout: unknown; customFontData: string | null },
  ): Promise<Uint8Array> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    const settings = await this.prisma.organizationSettings.findUnique({ where: { organizationId } });

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage(A4_LANDSCAPE);
    const { width, height } = page.getSize();
    const regular = await this.fonts.embedBodyFont(pdfDoc);
    const bold = await this.fonts.embedBoldFont(pdfDoc);
    const custom = template.customFontData ? await this.fonts.embedCustomFont(pdfDoc, template.customFontData) : undefined;

    const bg = hexOrWhite(template.backgroundColor);
    page.drawRectangle({ x: 0, y: 0, width, height, color: bg });

    if (settings?.watermarkEnabled) {
      drawWatermark(page, { text: settings.watermarkText, font: bold, opacity: settings.watermarkOpacity });
    }

    const data: ResolvedFieldData = {
      memberName: member.fullName,
      memberId: member.memberId,
      membershipType: member.membershipType.name,
      membershipDate: member.membershipDate.toLocaleDateString(),
      issueDate: new Date().toLocaleDateString(),
      certificateNumber,
      bloodGroup: member.bloodGroup ?? undefined,
      orgName: org?.name ?? "Lifeline Achham",
      photo: member.profilePhotoUrl ?? undefined,
      orgLogo: settings?.logoUrl?.startsWith("data:") ? settings.logoUrl : undefined,
      qr: qrPng,
    };

    await renderTemplateSide(pdfDoc, page, (template.frontLayout as any) ?? [], data, { regular, bold, custom }, width, height);

    return pdfDoc.save();
  }

  private async generateDefaultDesign(
    organizationId: string,
    member: Awaited<ReturnType<typeof this.getMember>>,
    certificateNumber: string,
    qrPng: Uint8Array,
  ): Promise<Uint8Array> {
    const settings = await this.prisma.organizationSettings.findUnique({ where: { organizationId } });
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage(A4_LANDSCAPE);
    const { width, height } = page.getSize();
    const font = await this.fonts.embedBodyFont(pdfDoc);
    const boldFont = await this.fonts.embedBoldFont(pdfDoc);

    // Decorative border, deliberately restrained (Section 32: avoid
    // excessive ornamentation).
    page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: NAVY, borderWidth: 2 });
    page.drawRectangle({ x: 32, y: 32, width: width - 64, height: height - 64, borderColor: CRIMSON, borderWidth: 0.75 });

    if (settings?.watermarkEnabled) {
      drawWatermark(page, { text: settings.watermarkText, font: boldFont, opacity: settings.watermarkOpacity });
    }

    const center = (text: string, y: number, size: number, f = font, color = NAVY) => {
      const w = f.widthOfTextAtSize(text, size);
      page.drawText(text, { x: (width - w) / 2, y, size, font: f, color });
    };

    center((org?.name ?? "Lifeline Achham").toUpperCase(), height - 90, 22, boldFont);
    center("CERTIFICATE OF MEMBERSHIP", height - 130, 16, boldFont, CRIMSON);

    center("This is to certify that", height - 190, 12, font, MUTED);
    center(member.fullName, height - 225, 26, boldFont, NAVY);
    center(
      `has been granted ${member.membershipType.name} of ${org?.name ?? "Lifeline Achham"},`,
      height - 260,
      12,
    );
    center(
      `bearing Member ID ${member.memberId}, effective ${member.membershipDate.toLocaleDateString()}.`,
      height - 280,
      12,
    );

    page.drawText(`Certificate No: ${certificateNumber}`, { x: 60, y: 90, size: 9, font, color: MUTED });

    drawSignatureBlock(page, { x: width - 260, y: 90, font, label: "Authorized Signature" });
    drawSignatureBlock(page, { x: 100, y: 90, font, label: "Official Seal" });

    await embedQr(pdfDoc, page, qrPng, { x: width / 2 - 35, y: 55, size: 70 });

    drawFooter(page, { font, pageNumber: 1, totalPages: 1, generatedAt: new Date() });

    return pdfDoc.save();
  }

  // Section: "Bulk Certificates - select multiple members, generate
  // individual or combined PDF" - combined here means one PDF with one
  // certificate per page, in the same order as the member list given.
  async generateBulkPdf(organizationId: string, memberIds: string[], templateId?: string): Promise<Uint8Array> {
    const combined = await PDFDocument.create();
    for (const memberId of memberIds) {
      const bytes = await this.generatePdf(organizationId, memberId, templateId);
      const doc = await PDFDocument.load(bytes);
      const [page] = await combined.copyPages(doc, [0]);
      combined.addPage(page);
    }
    return combined.save();
  }
}

function hexOrWhite(hex: string) {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return rgb(1, 1, 1);
  const bigint = parseInt(clean, 16);
  return rgb(((bigint >> 16) & 255) / 255, ((bigint >> 8) & 255) / 255, (bigint & 255) / 255);
}
