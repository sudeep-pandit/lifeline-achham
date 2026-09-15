import { Global, Module } from "@nestjs/common";
import { PdfFontService } from "./pdf-font.service";

// Global: every document-generating module needs PdfFontService, and
// re-declaring it as a provider in each one would embed/load the font
// multiple times per request unnecessarily.
@Global()
@Module({
  providers: [PdfFontService],
  exports: [PdfFontService],
})
export class PdfModule {}
