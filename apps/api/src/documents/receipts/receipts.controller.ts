import { Controller, Get, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import { ReceiptsService } from "./receipts.service";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "@lifeline/types";

@Controller("documents/receipts")
@RequirePermissions("documents.receipts")
export class ReceiptsController {
  constructor(private readonly service: ReceiptsService) {}

  @Get(":paymentId/pdf")
  async pdf(@CurrentUser() user: AuthUser, @Param("paymentId") paymentId: string, @Res() res: Response) {
    const bytes = await this.service.generatePdf(user.organizationId, paymentId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="receipt.pdf"`);
    res.send(Buffer.from(bytes));
  }
}
