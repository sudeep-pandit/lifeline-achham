import { Module } from "@nestjs/common";
import { PdfModule } from "./pdf/pdf.module";
import { TemporaryRegistrationsModule } from "./temporary-registrations/temporary-registrations.module";
import { MembershipCardsModule } from "./membership-cards/membership-cards.module";
import { CertificatesModule } from "./certificates/certificates.module";
import { ReceiptsModule } from "./receipts/receipts.module";

// Aggregates every document-generation sub-module (Section 40's "dedicated
// PDF service") so app.module.ts imports one thing.
@Module({
  imports: [PdfModule, TemporaryRegistrationsModule, MembershipCardsModule, CertificatesModule, ReceiptsModule],
})
export class DocumentsModule {}
