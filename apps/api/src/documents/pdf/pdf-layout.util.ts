import { PDFDocument, PDFFont, PDFPage, rgb, degrees } from "pdf-lib";

// A4 in points (72pt/inch): 210mm x 297mm.
export const A4_PORTRAIT: [number, number] = [595.28, 841.89];
export const A4_LANDSCAPE: [number, number] = [841.89, 595.28];

export const INK = rgb(0.106, 0.133, 0.2);       // matches web --ink
export const NAVY = rgb(0.106, 0.165, 0.29);     // matches web --navy
export const CRIMSON = rgb(0.651, 0.098, 0.180); // matches web --crimson
export const MUTED = rgb(0.45, 0.47, 0.53);

interface HeaderParams {
  orgName: string;
  documentTitle: string;
  font: PDFFont;
  boldFont: PDFFont;
}

// Section 22/40: consistent header block ("ORG NAME [LOGO] / REPORT TITLE")
// reused across every document and report type. Logo image embedding is
// left as a documented next step (see docs/DATABASE_PLAN.md) since it
// needs a real logo asset fetched from OrganizationSettings.logoUrl at
// generation time.
export function drawHeader(page: PDFPage, params: HeaderParams) {
  const { width, height } = page.getSize();
  page.drawText(params.orgName.toUpperCase(), {
    x: 40,
    y: height - 50,
    size: 16,
    font: params.boldFont,
    color: NAVY,
  });
  page.drawText(params.documentTitle, {
    x: 40,
    y: height - 70,
    size: 11,
    font: params.font,
    color: MUTED,
  });
  page.drawLine({
    start: { x: 40, y: height - 82 },
    end: { x: width - 40, y: height - 82 },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
}

export function drawFooter(page: PDFPage, params: { font: PDFFont; pageNumber: number; totalPages: number; generatedAt: Date }) {
  const { width } = page.getSize();
  page.drawText(`Page ${params.pageNumber} of ${params.totalPages}`, {
    x: width - 120,
    y: 30,
    size: 8,
    font: params.font,
    color: MUTED,
  });
  page.drawText(`Generated ${params.generatedAt.toLocaleString()}`, {
    x: 40,
    y: 30,
    size: 8,
    font: params.font,
    color: MUTED,
  });
}

// Section 17: subtle diagonal watermark, opacity/text configurable from
// OrganizationSettings rather than hard-coded.
export function drawWatermark(page: PDFPage, params: { text: string; font: PDFFont; opacity: number }) {
  if (!params.text || params.opacity <= 0) return;
  const { width, height } = page.getSize();
  const size = 48;
  page.drawText(params.text.toUpperCase(), {
    x: width / 2 - (params.text.length * size) / 4,
    y: height / 2,
    size,
    font: params.font,
    color: NAVY,
    opacity: Math.min(params.opacity, 1),
    rotate: degrees(35),
  });
}

export function drawSignatureBlock(page: PDFPage, params: { x: number; y: number; font: PDFFont; label: string }) {
  page.drawLine({ start: { x: params.x, y: params.y }, end: { x: params.x + 160, y: params.y }, thickness: 1, color: MUTED });
  page.drawText(params.label, { x: params.x, y: params.y - 14, size: 9, font: params.font, color: MUTED });
}

export async function embedQr(pdfDoc: PDFDocument, page: PDFPage, pngBytes: Uint8Array, params: { x: number; y: number; size: number }) {
  const image = await pdfDoc.embedPng(pngBytes);
  page.drawImage(image, { x: params.x, y: params.y, width: params.size, height: params.size });
}
