import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { RolesService } from "./roles.service";
import { UpsertRoleDto } from "./dto/upsert-role.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Audit } from "../common/decorators/audit.decorator";
import type { AuthUser } from "@lifeline/types";

@Controller("roles")
@RequirePermissions("roles.manage")
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // Overrides the class-level roles.manage requirement: any authenticated
  // user can list roles (needed so e.g. an Admin creating a user can see
  // what roles exist to assign) - only creating/editing/disabling a role
  // is actually sensitive and stays gated below.
  @Get()
  @RequirePermissions()
  findAll(@CurrentUser() user: AuthUser) {
    return this.rolesService.findAll(user.organizationId);
  }

  @Post()
  @Audit({ action: "role.create", module: "roles" })
  create(@CurrentUser() user: AuthUser, @Body() dto: UpsertRoleDto) {
    return this.rolesService.create(user.organizationId, dto);
  }

  @Patch(":id")
  @Audit({ action: "role.edit", module: "roles" })
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpsertRoleDto) {
    return this.rolesService.update(user.organizationId, id, dto);
  }

  @Delete(":id")
  @Audit({ action: "role.disable", module: "roles" })
  disable(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.rolesService.disable(user.organizationId, id);
  }
}
