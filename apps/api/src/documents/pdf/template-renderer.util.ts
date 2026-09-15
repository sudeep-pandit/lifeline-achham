import { PDFDocument, PDFFont, PDFPage, rgb, degrees } from "pdf-lib";
import type { PdfFontService } from "./pdf-font.service";

// Mirrors packages/types' TemplateElement shape (kept as a plain type here
// rather than importing @lifeline/types, since this file only needs the
// shape, not the rest of the shared package).
export interface TemplateElement {
  id: string;
  kind: "text" | "image" | "shape" | "field";
  x: number; y: number; width: number; height: number; // percentages 0-100
  rotation: number;
  zIndex: number;
  locked?: boolean;
  hidden?: boolean;
  text?: string;
  fontFamily?: "regular" | "bold" | "custom";
  fontSize?: number;
  color?: string;
  align?: "left" | "center" | "right";
  field?: string;
  imageData?: string;
  shapeType?: "rectangle" | "line" | "circle";
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
}

export interface ResolvedFieldData {
  memberName?: string;
  memberId?: string;
  membershipType?: string;
  membershipDate?: string;
  validUntil?: string;
  cardNumber?: string;
  certificateNumber?: string;
  issueDate?: string;
  orgName?: string;
  bloodGroup?: string;
  photo?: string; // base64 data URL
  orgLogo?: string; // base64 data URL
  qr?: Uint8Array; // pre-rendered QR PNG bytes
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  return rgb(((bigint >> 16) & 255) / 255, ((bigint >> 8) & 255) / 255, (bigint & 255) / 255);
}

function fieldText(key: string | undefined, data: ResolvedFieldData): string {
  if (!key) return "";
  const map: Record<string, string | undefined> = {
    memberName: data.memberName,
    memberId: data.memberId,
    membershipType: data.membershipType,
    membershipDate: data.membershipDate,
    validUntil: data.validUntil,
    cardNumber: data.cardNumber,
    certificateNumber: data.certificateNumber,
    issueDate: data.issueDate,
    orgName: data.orgName,
    bloodGroup: data.bloodGroup,
  };
  return map[key] ?? "";
}

// Renders one side (front or back) of a template onto a page whose size is
// canvasWidthPt x canvasHeightPt. Percentage coordinates make the same
// layout reusable across a business-card-sized ID card and an A4
// certificate without the designer needing to know the final PDF units.
//
// Rotation note: elements rotate around their bottom-left corner (pdf-lib's
// native anchor for drawText/drawImage/drawRectangle), not their visual
// center - a deliberate simplification. True center-pivot rotation needs
// pdf-lib's low-level content-stream operators (push/translate/rotate/pop),
// which is real but meaningfully more code; this covers the common case
// (small rotation adjustments on text/logos) correctly enough to be useful.
export async function renderTemplateSide(
  pdfDoc: PDFDocument,
  page: PDFPage,
  elements: TemplateElement[],
  data: ResolvedFieldData,
  fonts: { regular: PDFFont; bold: PDFFont; custom?: PDFFont },
  canvasWidthPt: number,
  canvasHeightPt: number,
) {
  const sorted = [...elements].filter((e) => !e.hidden).sort((a, b) => a.zIndex - b.zIndex);

  for (const el of sorted) {
    const x = (el.x / 100) * canvasWidthPt;
    // PDF y-origin is bottom-left; designer y-origin is top-left, so flip.
    const yTop = (el.y / 100) * canvasHeightPt;
    const height = (el.height / 100) * canvasHeightPt;
    const y = canvasHeightPt - yTop - height;
    const width = (el.width / 100) * canvasWidthPt;
    const rotate = degrees(el.rotation || 0);

    if (el.kind === "shape") {
      if (el.shapeType === "line") {
        page.drawLine({
          start: { x, y: y + height / 2 },
          end: { x: x + width, y: y + height / 2 },
          thickness: el.borderWidth ?? 1,
          color: el.borderColor ? hexToRgb(el.borderColor) : rgb(0, 0, 0),
        });
      } else if (el.shapeType === "circle") {
        page.drawEllipse({
          x: x + width / 2,
          y: y + height / 2,
          xScale: width / 2,
          yScale: height / 2,
          color: el.fillColor ? hexToRgb(el.fillColor) : undefined,
          borderColor: el.borderColor ? hexToRgb(el.borderColor) : undefined,
          borderWidth: el.borderWidth ?? 0,
          rotate,
        });
      } else {
        page.drawRectangle({
          x, y, width, height,
          color: el.fillColor ? hexToRgb(el.fillColor) : undefined,
          borderColor: el.borderColor ? hexToRgb(el.borderColor) : undefined,
          borderWidth: el.borderWidth ?? (el.borderColor ? 1 : 0),
          rotate,
        });
      }
      continue;
    }

    if (el.kind === "image" || el.field === "photo" || el.field === "orgLogo") {
      const src = el.kind === "image" ? el.imageData : el.field === "photo" ? data.photo : data.orgLogo;
      if (!src) continue;
      try {
        const base64 = src.split(",")[1] ?? src;
        const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
        const image = src.includes("image/png") ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        page.drawImage(image, { x, y, width, height, rotate });
      } catch {
        // A corrupt/unsupported image should never fail the whole document -
        // skip just this element.
      }
      continue;
    }

    if (el.field === "qr" && data.qr) {
      const image = await pdfDoc.embedPng(data.qr);
      page.drawImage(image, { x, y, width, height, rotate });
      continue;
    }

    // text or field->text
    const text = el.kind === "field" ? fieldText(el.field, data) : (el.text ?? "");
    if (!text) continue;
    const font = el.fontFamily === "bold" ? fonts.bold : el.fontFamily === "custom" && fonts.custom ? fonts.custom : fonts.regular;
    const size = el.fontSize ?? 12;
    const color = el.color ? hexToRgb(el.color) : rgb(0.106, 0.133, 0.2);

    let textX = x;
    if (el.align === "center") textX = x + width / 2 - font.widthOfTextAtSize(text, size) / 2;
    if (el.align === "right") textX = x + width - font.widthOfTextAtSize(text, size);

    page.drawText(text, { x: textX, y: y + height / 2 - size / 2, size, font, color, rotate });
  }
}
