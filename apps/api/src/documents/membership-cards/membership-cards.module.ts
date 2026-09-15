import { Module } from "@nestjs/common";
import { MembershipCardsController } from "./membership-cards.controller";
import { MembershipCardsService } from "./membership-cards.service";
import { OrganizationsModule } from "../../organizations/organizations.module";
import { DocumentTemplatesModule } from "../../document-templates/document-templates.module";

@Module({
  imports: [OrganizationsModule, DocumentTemplatesModule],
  controllers: [MembershipCardsController],
  providers: [MembershipCardsService],
  exports: [MembershipCardsService],
})
export class MembershipCardsModule {}
