import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApplicationsService } from "./applications.service";
import { CreateApplicationDto } from "./dto/create-application.dto";
import { ReviewApplicationDto } from "./dto/review-application.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { Audit } from "../common/decorators/audit.decorator";
import type { AuthUser } from "@lifeline/types";
import type { ApplicationStatus } from "@prisma/client";

// Phase 2 is single-organization, so the public endpoints resolve the org
// via OrganizationsService's default org rather than a client-supplied id
// (never trust organizationId from an unauthenticated caller for writes).
const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

@Controller("applications")
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Public()
  @Post("public")
  @Audit({ action: "application.submit", module: "applications" })
  submit(@Query("organizationId") organizationId: string | undefined, @Body() dto: CreateApplicationDto) {
    return this.applicationsService.submit(organizationId || DEFAULT_ORG_ID, dto);
  }

  @Public()
  @Get("track")
  track(@Query("applicationNumber") applicationNumber: string) {
    return this.applicationsService.trackByNumber(DEFAULT_ORG_ID, applicationNumber);
  }

  @Get()
  @RequirePermissions("applications.view")
  findAll(@CurrentUser() user: AuthUser, @Query("status") status?: ApplicationStatus) {
    return this.applicationsService.findAll(user.organizationId, status);
  }

  @Get(":id")
  @RequirePermissions("applications.view")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.applicationsService.findOne(user.organizationId, id);
  }

  @Patch(":id/review")
  @RequirePermissions("applications.review")
  @Audit({ action: "application.review", module: "applications" })
  review(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: ReviewApplicationDto) {
    return this.applicationsService.review(user.organizationId, id, user.id, dto);
  }
}
