import { Body, Controller, Get, Param, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { CertificatesService } from "./certificates.service";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Audit } from "../../common/decorators/audit.decorator";
import type { AuthUser } from "@lifeline/types";

@Controller("documents/certificates")
@RequirePermissions("documents.certificates")
export class CertificatesController {
  constructor(private readonly service: CertificatesService) {}

  @Get(":memberId/pdf")
  async pdf(
    @CurrentUser() user: AuthUser,
    @Param("memberId") memberId: string,
    @Query("templateId") templateId: string | undefined,
    @Res() res: Response,
  ) {
    const bytes = await this.service.generatePdf(user.organizationId, memberId, templateId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="certificate.pdf"`);
    res.send(Buffer.from(bytes));
  }

  // Section: "Bulk Certificates" - combined PDF, one certificate per page,
  // with real per-member Certificate Numbers and Member IDs.
  @Post("bulk/pdf")
  @Audit({ action: "certificate.bulk_generate", module: "documents" })
  async bulkPdf(
    @CurrentUser() user: AuthUser,
    @Body() body: { memberIds: string[]; templateId?: string },
    @Res() res: Response,
  ) {
    const bytes = await this.service.generateBulkPdf(user.organizationId, body.memberIds, body.templateId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="certificates-bulk.pdf"`);
    res.send(Buffer.from(bytes));
  }
}
