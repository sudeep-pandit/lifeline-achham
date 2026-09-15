import { Controller, Get, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import { TemporaryRegistrationsService } from "./temporary-registrations.service";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { AuthUser } from "@lifeline/types";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

function sendPdf(res: Response, bytes: Uint8Array, filename: string) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  res.send(Buffer.from(bytes));
}

@Controller("documents/temporary-registrations")
export class TemporaryRegistrationsController {
  constructor(private readonly service: TemporaryRegistrationsService) {}

  // Public: the applicant can fetch their own temporary registration using
  // the application number they were given at submission time - acts as a
  // shared secret (no other personal data is guessable from it).
  @Public()
  @Get("public/:applicationNumber/pdf")
  async publicPdf(@Param("applicationNumber") applicationNumber: string, @Res() res: Response) {
    const record = await this.service.findByApplicationNumber(DEFAULT_ORG_ID, applicationNumber);
    const bytes = await this.service.generatePdf(DEFAULT_ORG_ID, record.applicationId);
    sendPdf(res, bytes, `${record.registrationNumber}.pdf`);
  }

  @Get(":applicationId/pdf")
  @RequirePermissions("documents.temporary_registration")
  async pdf(@CurrentUser() user: AuthUser, @Param("applicationId") applicationId: string, @Res() res: Response) {
    const bytes = await this.service.generatePdf(user.organizationId, applicationId);
    sendPdf(res, bytes, "temporary-registration.pdf");
  }
}
