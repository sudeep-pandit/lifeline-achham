import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { ReportsService } from "./reports.service";
import { renderReportPdf, type ReportData } from "./report-table-pdf.util";
import { PdfFontService } from "../documents/pdf/pdf-font.service";
import { PrismaService } from "../prisma/prisma.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "@lifeline/types";

// Section 22: every report supports View (JSON, default) / Filter (query
// params) / Print+Download PDF (?format=pdf). One shared method resolves
// the requested ReportData and either returns it as JSON or streams it
// through the shared paginated PDF renderer - so every report type gets
// identical behavior for free.
@Controller("reports")
@RequirePermissions("reports.view")
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly prisma: PrismaService,
    private readonly fonts: PdfFontService,
  ) {}

  private async respond(user: AuthUser, format: string | undefined, res: Response, data: ReportData) {
    if (format !== "pdf") {
      res.json(data);
      return;
    }
    if (!user.isSuperAdmin && !user.permissions.includes("reports.export")) {
      res.status(403).json({ statusCode: 403, message: "Missing required permission(s): reports.export" });
      return;
    }
    const settings = await this.prisma.organizationSettings.findUnique({ where: { organizationId: user.organizationId } });
    const org = await this.prisma.organization.findUnique({ where: { id: user.organizationId } });
    const bytes = await renderReportPdf(data, {
      orgName: org?.name ?? "Lifeline Achham",
      watermarkText: settings?.watermarkEnabled ? settings.watermarkText : undefined,
      watermarkOpacity: settings?.watermarkOpacity,
      generatedBy: user.fullName,
      fonts: this.fonts,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="report.pdf"`);
    res.send(Buffer.from(bytes));
  }

  // --- Member reports ---

  @Get("members")
  async members(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query("view") view = "all",
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("format") format?: string,
  ) {
    const data = await this.reportsService.memberReport(user.organizationId, view, { from, to });
    await this.respond(user, format, res, data);
  }

  @Get("members/by-district")
  async byDistrict(@CurrentUser() user: AuthUser, @Res() res: Response, @Query("format") format?: string) {
    const data = await this.reportsService.membersByGeography(user.organizationId, "district");
    await this.respond(user, format, res, data);
  }

  @Get("members/by-municipality")
  async byMunicipality(@CurrentUser() user: AuthUser, @Res() res: Response, @Query("format") format?: string) {
    const data = await this.reportsService.membersByGeography(user.organizationId, "municipality");
    await this.respond(user, format, res, data);
  }

  @Get("members/by-ward")
  async byWard(@CurrentUser() user: AuthUser, @Res() res: Response, @Query("format") format?: string) {
    const data = await this.reportsService.membersByGeography(user.organizationId, "ward");
    await this.respond(user, format, res, data);
  }

  @Get("members/by-type")
  async byType(@CurrentUser() user: AuthUser, @Res() res: Response, @Query("format") format?: string) {
    const data = await this.reportsService.membersByType(user.organizationId);
    await this.respond(user, format, res, data);
  }

  // --- Financial reports ---

  @Get("income")
  async income(@CurrentUser() user: AuthUser, @Res() res: Response, @Query("from") from?: string, @Query("to") to?: string, @Query("format") format?: string) {
    const data = await this.reportsService.incomeReport(user.organizationId, { from, to });
    await this.respond(user, format, res, data);
  }

  @Get("expenses")
  async expenses(@CurrentUser() user: AuthUser, @Res() res: Response, @Query("from") from?: string, @Query("to") to?: string, @Query("format") format?: string) {
    const data = await this.reportsService.expenseReport(user.organizationId, { from, to });
    await this.respond(user, format, res, data);
  }

  @Get("financial/income-vs-expenses")
  async incomeVsExpenses(@CurrentUser() user: AuthUser, @Res() res: Response, @Query("from") from?: string, @Query("to") to?: string, @Query("format") format?: string) {
    const data = await this.reportsService.incomeVsExpenses(user.organizationId, { from, to });
    await this.respond(user, format, res, data);
  }

  @Get("financial/collection/:granularity")
  async collection(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Param("granularity") granularity: "daily" | "monthly" | "yearly",
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("format") format?: string,
  ) {
    const data = await this.reportsService.collectionReport(user.organizationId, granularity, { from, to });
    await this.respond(user, format, res, data);
  }

  @Get("financial/membership-revenue")
  async membershipRevenue(@CurrentUser() user: AuthUser, @Res() res: Response, @Query("from") from?: string, @Query("to") to?: string, @Query("format") format?: string) {
    const data = await this.reportsService.membershipRevenue(user.organizationId, { from, to });
    await this.respond(user, format, res, data);
  }

  @Get("financial/payment-methods")
  async paymentMethods(@CurrentUser() user: AuthUser, @Res() res: Response, @Query("from") from?: string, @Query("to") to?: string, @Query("format") format?: string) {
    const data = await this.reportsService.paymentMethodReport(user.organizationId, { from, to });
    await this.respond(user, format, res, data);
  }

  @Get("financial/outstanding-balance")
  async outstandingBalance(@CurrentUser() user: AuthUser, @Res() res: Response, @Query("format") format?: string) {
    const data = await this.reportsService.outstandingBalanceReport(user.organizationId);
    await this.respond(user, format, res, data);
  }

  // --- Administrative reports ---

  @Get("administrative/user-activity")
  async userActivity(@CurrentUser() user: AuthUser, @Res() res: Response, @Query("from") from?: string, @Query("to") to?: string, @Query("format") format?: string) {
    const data = await this.reportsService.userActivityReport(user.organizationId, { from, to });
    await this.respond(user, format, res, data);
  }

  @Get("administrative/applications/:status")
  async applicationsByStatus(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Param("status") status: "APPROVED" | "REJECTED" | "PAYMENT_PENDING" | "SUBMITTED" | "UNDER_REVIEW",
    @Query("format") format?: string,
  ) {
    const data = await this.reportsService.applicationsByStatus(user.organizationId, status);
    await this.respond(user, format, res, data);
  }

  @Get("administrative/generated/:kind")
  async generatedDocuments(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Param("kind") kind: "cards" | "certificates" | "receipts",
    @Query("format") format?: string,
  ) {
    const data = await this.reportsService.generatedDocumentsReport(user.organizationId, kind);
    await this.respond(user, format, res, data);
  }
}
