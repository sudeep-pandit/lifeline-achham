import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { MembershipTypesService } from "./membership-types.service";
import { UpsertMembershipTypeDto } from "./dto/upsert-membership-type.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { Audit } from "../common/decorators/audit.decorator";
import type { AuthUser } from "@lifeline/types";

@Controller("membership-types")
export class MembershipTypesController {
  constructor(private readonly membershipTypesService: MembershipTypesService) {}

  // Public: the application form needs to show type/price/duration before login.
  @Public()
  @Get("public")
  findActive(@Query("organizationId") organizationId: string) {
    return this.membershipTypesService.findActive(organizationId);
  }

  @Get()
  @RequirePermissions("membership_types.manage")
  findAll(@CurrentUser() user: AuthUser) {
    return this.membershipTypesService.findAll(user.organizationId);
  }

  @Post()
  @RequirePermissions("membership_types.manage")
  @Audit({ action: "membership_type.create", module: "membership_types" })
  create(@CurrentUser() user: AuthUser, @Body() dto: UpsertMembershipTypeDto) {
    return this.membershipTypesService.create(user.organizationId, dto);
  }

  @Patch(":id")
  @RequirePermissions("membership_types.manage")
  @Audit({ action: "membership_type.edit", module: "membership_types" })
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpsertMembershipTypeDto) {
    return this.membershipTypesService.update(user.organizationId, id, dto);
  }

  @Patch(":id/deactivate")
  @RequirePermissions("membership_types.manage")
  @Audit({ action: "membership_type.deactivate", module: "membership_types" })
  deactivate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.membershipTypesService.setActive(user.organizationId, id, false);
  }
}
