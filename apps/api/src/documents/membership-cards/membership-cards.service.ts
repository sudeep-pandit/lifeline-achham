import { Injectable, NotFoundException } from "@nestjs/common";
import { PDFDocument, rgb } from "pdf-lib";
import { PrismaService } from "../../prisma/prisma.service";
import { OrganizationsService } from "../../organizations/organizations.service";
import { PdfFontService } from "../pdf/pdf-font.service";
import { generateQrPng } from "../pdf/qr.util";
import { embedQr, MUTED, NAVY } from "../pdf/pdf-layout.util";
import { renderTemplateSide, type ResolvedFieldData } from "../pdf/template-renderer.util";
import { DocumentTemplatesService } from "../../document-templates/document-templates.service";
import { ConfigService } from "@nestjs/config";

// Standard ID-1 card size (85.6mm x 54mm), in points.
const CARD_WIDTH = 242.6;
const CARD_HEIGHT = 153.1;

@Injectable()
export class MembershipCardsService {
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

  // Assigns a card number the first time a card is generated for this
  // member (Section 6: "Never allow duplicate IDs") - regenerating the PDF
  // later reuses the same number rather than issuing a new one.
  private async ensureCardNumber(organizationId: string, memberId: string): Promise<string> {
    const member = await this.getMember(organizationId, memberId);
    if (member.cardNumber) return member.cardNumber;
    const cardNumber = await this.organizationsService.nextSequenceNumber(organizationId, "card", "LA-CARD");
    await this.prisma.member.update({ where: { id: memberId }, data: { cardNumber } });
    return cardNumber;
  }

  async generatePdf(organizationId: string, memberId: string, templateId?: string): Promise<Uint8Array> {
    const cardNumber = await this.ensureCardNumber(organizationId, memberId);
    const member = await this.getMember(organizationId, memberId);
    const webUrl = this.config.get<string>("webUrl");
    const qrPng = await generateQrPng(`${webUrl}/verify/member/${member.memberId}`);

    const template = templateId
      ? await this.templatesService.findOne(organizationId, templateId)
      : await this.templatesService.findDefault(organizationId, "CARD");

    if (template) {
      return this.generateFromTemplate(organizationId, member, cardNumber, qrPng, template);
    }
    return this.generateDefaultDesign(organizationId, member, cardNumber, qrPng);
  }

  // Renders the admin-designed layout (Section: "fully customizable
  // two-sided ID Card Designer") - real member data substituted into
  // whatever "field" placeholders the designer placed.
  private async generateFromTemplate(
    organizationId: string,
    member: Awaited<ReturnType<typeof this.getMember>>,
    cardNumber: string,
    qrPng: Uint8Array,
    template: { backgroundColor: string; frontLayout: unknown; backLayout: unknown; customFontData: string | null },
  ): Promise<Uint8Array> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    const settings = await this.prisma.organizationSettings.findUnique({ where: { organizationId } });

    const pdfDoc = await PDFDocument.create();
    const regular = await this.fonts.embedBodyFont(pdfDoc);
    const bold = await this.fonts.embedBoldFont(pdfDoc);
    const custom = template.customFontData ? await this.fonts.embedCustomFont(pdfDoc, template.customFontData) : undefined;

    const data: ResolvedFieldData = {
      memberName: member.fullName,
      memberId: member.memberId,
      membershipType: member.membershipType.name,
      validUntil: member.expiresAt ? member.expiresAt.toLocaleDateString() : "LIFETIME",
      cardNumber,
      bloodGroup: member.bloodGroup ?? undefined,
      orgName: org?.name ?? "Lifeline Achham",
      photo: member.profilePhotoUrl ?? undefined,
      orgLogo: settings?.logoUrl?.startsWith("data:") ? settings.logoUrl : undefined,
      qr: qrPng,
    };

    const bg = hexOrDefault(template.backgroundColor);
    const front = pdfDoc.addPage([CARD_WIDTH, CARD_HEIGHT]);
    front.drawRectangle({ x: 0, y: 0, width: CARD_WIDTH, height: CARD_HEIGHT, color: bg });
    await renderTemplateSide(pdfDoc, front, (template.frontLayout as any) ?? [], data, { regular, bold, custom }, CARD_WIDTH, CARD_HEIGHT);

    if (template.backLayout) {
      const back = pdfDoc.addPage([CARD_WIDTH, CARD_HEIGHT]);
      back.drawRectangle({ x: 0, y: 0, width: CARD_WIDTH, height: CARD_HEIGHT, color: bg });
      await renderTemplateSide(pdfDoc, back, (template.backLayout as any) ?? [], data, { regular, bold, custom }, CARD_WIDTH, CARD_HEIGHT);
    }

    return pdfDoc.save();
  }

  // The original built-in layout - always available, so card generation
  // never breaks for an org that hasn't opened the designer yet.
  private async generateDefaultDesign(
    organizationId: string,
    member: Awaited<ReturnType<typeof this.getMember>>,
    cardNumber: string,
    qrPng: Uint8Array,
  ): Promise<Uint8Array> {
    const settings = await this.prisma.organizationSettings.findUnique({ where: { organizationId } });
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });

    const pdfDoc = await PDFDocument.create();
    const font = await this.fonts.embedBodyFont(pdfDoc);
    const boldFont = await this.fonts.embedBoldFont(pdfDoc);

    // --- Front ---
    const front = pdfDoc.addPage([CARD_WIDTH, CARD_HEIGHT]);
    front.drawRectangle({ x: 0, y: 0, width: CARD_WIDTH, height: CARD_HEIGHT, color: NAVY });
    front.drawText(org?.name.toUpperCase() ?? "LIFELINE ACHHAM", { x: 12, y: CARD_HEIGHT - 22, size: 10, font: boldFont, color: rgb(1, 1, 1) });
    front.drawText("MEMBERSHIP CARD", { x: 12, y: CARD_HEIGHT - 36, size: 7, font, color: rgb(0.85, 0.85, 0.9) });

    if (member.profilePhotoUrl) {
      try {
        const base64 = member.profilePhotoUrl.split(",")[1] ?? member.profilePhotoUrl;
        const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
        const image = member.profilePhotoUrl.includes("image/png") ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        front.drawImage(image, { x: 12, y: 40, width: 55, height: 68 });
      } catch {
        front.drawRectangle({ x: 12, y: 40, width: 55, height: 68, color: rgb(1, 1, 1), opacity: 0.15, borderColor: rgb(1, 1, 1), borderWidth: 0.5 });
      }
    } else {
      front.drawRectangle({ x: 12, y: 40, width: 55, height: 68, color: rgb(1, 1, 1), opacity: 0.15, borderColor: rgb(1, 1, 1), borderWidth: 0.5 });
      front.drawText("PHOTO", { x: 24, y: 70, size: 7, font, color: rgb(1, 1, 1), opacity: 0.6 });
    }

    const infoX = 78;
    let infoY = CARD_HEIGHT - 60;
    const infoLine = (label: string, value: string) => {
      front.drawText(label, { x: infoX, y: infoY, size: 6, font, color: rgb(0.75, 0.8, 0.9) });
      front.drawText(value, { x: infoX, y: infoY - 10, size: 9, font: boldFont, color: rgb(1, 1, 1) });
      infoY -= 24;
    };
    infoLine("Name", member.fullName);
    infoLine("Member ID", member.memberId);
    infoLine("Membership Type", member.membershipType.name);
    if (member.bloodGroup) infoLine("Blood Group", member.bloodGroup);
    infoLine("Valid Until", member.expiresAt ? member.expiresAt.toLocaleDateString() : "LIFETIME");

    front.drawText(`Card No: ${cardNumber}`, { x: 12, y: 10, size: 6, font, color: rgb(0.75, 0.8, 0.9) });

    // --- Back ---
    const back = pdfDoc.addPage([CARD_WIDTH, CARD_HEIGHT]);
    back.drawRectangle({ x: 0, y: 0, width: CARD_WIDTH, height: CARD_HEIGHT, color: rgb(0.97, 0.96, 0.94) });
    back.drawText(org?.name ?? "Lifeline Achham", { x: 12, y: CARD_HEIGHT - 20, size: 9, font: boldFont, color: NAVY });
    const backLines = [settings?.address, settings?.phone, settings?.email, settings?.website].filter(Boolean) as string[];
    let backY = CARD_HEIGHT - 34;
    for (const l of backLines) {
      back.drawText(l, { x: 12, y: backY, size: 6.5, font, color: MUTED });
      backY -= 10;
    }
    back.drawText("This card remains the property of the organization and must be", { x: 12, y: 50, size: 5.5, font, color: MUTED });
    back.drawText("surrendered upon request. Report loss immediately.", { x: 12, y: 42, size: 5.5, font, color: MUTED });
    await embedQr(pdfDoc, back, qrPng, { x: CARD_WIDTH - 62, y: 12, size: 50 });

    return pdfDoc.save();
  }

  // Bulk generation (Section: "A4 Bulk ID Card Generation" - 5 across, 2
  // rows, 10 per sheet, standard card dimensions preserved).
  async generateBulkSheet(organizationId: string, memberIds: string[], templateId?: string): Promise<Uint8Array> {
    const A4_LANDSCAPE_WIDTH = 841.89;
    const A4_LANDSCAPE_HEIGHT = 595.28;
    const COLS = 5;
    const ROWS = 2;
    const MARGIN = 20;
    const GAP = 8;
    const cellWidth = (A4_LANDSCAPE_WIDTH - MARGIN * 2 - GAP * (COLS - 1)) / COLS;
    const cellHeight = (A4_LANDSCAPE_HEIGHT - MARGIN * 2 - GAP * (ROWS - 1)) / ROWS;

    const sheet = await PDFDocument.create();
    const cardsPerSheet = COLS * ROWS;

    // Front sheets and back sheets are separate documents (duplex-ready:
    // print fronts, flip the stack, print backs) rather than interleaved
    // front/back pages, since that's how duplex card-stock printing
    // actually works in practice.
    const backSheet = await PDFDocument.create();

    for (let start = 0; start < memberIds.length; start += cardsPerSheet) {
      const batch = memberIds.slice(start, start + cardsPerSheet);
      const frontPage = sheet.addPage([A4_LANDSCAPE_WIDTH, A4_LANDSCAPE_HEIGHT]);
      const backPage = backSheet.addPage([A4_LANDSCAPE_WIDTH, A4_LANDSCAPE_HEIGHT]);

      for (let i = 0; i < batch.length; i++) {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const x = MARGIN + col * (cellWidth + GAP);
        // Back sheet mirrors columns horizontally so, after flipping the
        // paper on its short edge, each card's back lines up with its front.
        const backCol = COLS - 1 - col;
        const backX = MARGIN + backCol * (cellWidth + GAP);
        const y = A4_LANDSCAPE_HEIGHT - MARGIN - (row + 1) * cellHeight - row * GAP;

        const cardBytes = await this.generatePdf(organizationId, batch[i], templateId);
        const cardDoc = await PDFDocument.load(cardBytes);
        const cardPages = cardDoc.getPages();

        const embeddedFront = await sheet.embedPage(cardPages[0]);
        frontPage.drawPage(embeddedFront, { x, y, width: cellWidth, height: cellHeight });

        if (cardPages.length > 1) {
          const embeddedBack = await backSheet.embedPage(cardPages[1]);
          backPage.drawPage(embeddedBack, { x: backX, y, width: cellWidth, height: cellHeight });
        }
      }
    }

    // Append the back sheets after the front sheets in one combined PDF -
    // still print-ready (front pages first, matching sheets follow), and
    // simpler to hand the caller one file rather than two.
    const backPages = await sheet.copyPages(backSheet, backSheet.getPageIndices());
    backPages.forEach((p) => sheet.addPage(p));

    return sheet.save();
  }
}

function hexOrDefault(hex: string) {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return rgb(1, 1, 1);
  const bigint = parseInt(clean, 16);
  return rgb(((bigint >> 16) & 255) / 255, ((bigint >> 8) & 255) / 255, (bigint & 255) / 255);
}
