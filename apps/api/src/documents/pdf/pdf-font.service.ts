import { Injectable, Logger } from "@nestjs/common";
import { PDFDocument, PDFFont, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

// Resolved relative to the process's working directory (apps/api, whether
// running via `nest start` in dev or `node dist/main.js` in production -
// both are launched from apps/api) rather than __dirname, since __dirname
// would point into dist/ after a build and this asset folder is never
// copied there.
const UNICODE_FONT_PATH = join(process.cwd(), "assets", "fonts", "NotoSansDevanagari-Regular.ttf");

// Section 40: "Use appropriate fonts that support both English and Nepali
// Unicode." Embeds a real Unicode font when the asset is present (see
// apps/api/assets/fonts/README.md); falls back to Helvetica (Latin-only)
// otherwise so English-language documents still render correctly.
@Injectable()
export class PdfFontService {
  private readonly logger = new Logger(PdfFontService.name);

  async embedBodyFont(pdfDoc: PDFDocument): Promise<PDFFont> {
    pdfDoc.registerFontkit(fontkit);

    if (existsSync(UNICODE_FONT_PATH)) {
      try {
        const bytes = readFileSync(UNICODE_FONT_PATH);
        return await pdfDoc.embedFont(bytes, { subset: true });
      } catch (err) {
        this.logger.warn(`Failed to embed Unicode font, falling back to Helvetica: ${err}`);
      }
    }

    return pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  async embedBoldFont(pdfDoc: PDFDocument): Promise<PDFFont> {
    return pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }

  // Per-template custom font (Section: "Support .ttf/.otf fonts... Nepali
  // Unicode, Devanagari fonts"). Unlike embedBodyFont's org-wide fallback
  // file, this comes from a specific template's uploaded font (stored as
  // base64 on DocumentTemplate.customFontData) - a designer can use the
  // bundled Unicode fallback for most text and still opt a specific
  // template into its own font for an exact brand match.
  async embedCustomFont(pdfDoc: PDFDocument, base64FontData: string): Promise<PDFFont | undefined> {
    pdfDoc.registerFontkit(fontkit);
    try {
      const raw = base64FontData.includes(",") ? base64FontData.split(",")[1] : base64FontData;
      const bytes = Buffer.from(raw, "base64");
      return await pdfDoc.embedFont(bytes, { subset: true });
    } catch (err) {
      this.logger.warn(`Failed to embed template's custom font, falling back to the default Unicode font: ${err}`);
      return undefined;
    }
  }
}
