import { Body, Controller, Get, Param, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { MembershipCardsService } from "./membership-cards.service";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Audit } from "../../common/decorators/audit.decorator";
import type { AuthUser } from "@lifeline/types";

@Controller("documents/membership-cards")
@RequirePermissions("documents.cards")
export class MembershipCardsController {
  constructor(private readonly service: MembershipCardsService) {}

  @Get(":memberId/pdf")
  async pdf(
    @CurrentUser() user: AuthUser,
    @Param("memberId") memberId: string,
    @Query("templateId") templateId: string | undefined,
    @Res() res: Response,
  ) {
    const bytes = await this.service.generatePdf(user.organizationId, memberId, templateId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="membership-card.pdf"`);
    res.send(Buffer.from(bytes));
  }

  // Section: "A4 Bulk ID Card Generation - select multiple members,
  // generate in bulk, front and back, duplex-print-ready."
  @Post("bulk/pdf")
  @Audit({ action: "membership_card.bulk_generate", module: "documents" })
  async bulkPdf(
    @CurrentUser() user: AuthUser,
    @Body() body: { memberIds: string[]; templateId?: string },
    @Res() res: Response,
  ) {
    const bytes = await this.service.generateBulkSheet(user.organizationId, body.memberIds, body.templateId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="membership-cards-bulk.pdf"`);
    res.send(Buffer.from(bytes));
  }
}
