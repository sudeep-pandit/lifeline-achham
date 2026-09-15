# Fonts for PDF generation

Section 40 requires PDF output to support both English and Nepali Unicode
text. pdf-lib's built-in fonts (Helvetica etc.) are Latin-only, so
rendering Nepali (Devanagari) text requires embedding a real Unicode font
file.

**This folder is intentionally empty in the delivered repo** — no network
access was available while building this to download a font file, and
redistributing a licensed font isn't appropriate to guess at.

Before Nepali text needs to render correctly:

1. Download a Unicode Devanagari-supporting font, e.g. **Noto Sans
   Devanagari** (SIL Open Font License, freely redistributable) from
   Google Fonts.
2. Place the `.ttf` file here as `NotoSansDevanagari-Regular.ttf` (and
   `-Bold.ttf` if you want bold support).
3. `PdfFontService` (see `../pdf/pdf-font.service.ts`) already looks for
   exactly this path and embeds it via `@pdf-lib/fontkit` automatically —
   no code changes needed.

Until then, `PdfFontService` falls back to Helvetica, which renders
English text fine but will show blank boxes for Devanagari characters.
