import { Module } from "@nestjs/common";
import { CertificatesController } from "./certificates.controller";
import { CertificatesService } from "./certificates.service";
import { OrganizationsModule } from "../../organizations/organizations.module";
import { DocumentTemplatesModule } from "../../document-templates/document-templates.module";

@Module({
  imports: [OrganizationsModule, DocumentTemplatesModule],
  controllers: [CertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
