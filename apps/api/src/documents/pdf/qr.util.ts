import * as QRCode from "qrcode";

// Generates a QR code as raw PNG bytes, ready to embed into a pdf-lib page
// via pdfDoc.embedPng(). Used by every document type (Section 24).
export async function generateQrPng(data: string): Promise<Uint8Array> {
  const dataUrl = await QRCode.toDataURL(data, { margin: 1, width: 240 });
  const base64 = dataUrl.split(",")[1];
  return Uint8Array.from(Buffer.from(base64, "base64"));
}
