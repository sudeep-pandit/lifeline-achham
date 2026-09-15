import { Body, Controller, Get, Patch } from "@nestjs/common";
import { OrganizationsService } from "./organizations.service";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { Audit } from "../common/decorators/audit.decorator";
import type { AuthUser } from "@lifeline/types";

@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  // Public: the public website (Section 34) also needs org name/logo/social
  // links, but never anything financial or user-related.
  @Public()
  @Get("public-profile")
  async publicProfile(@CurrentUser() _unused: AuthUser) {
    // In a real deployment this reads the single-tenant org id from config;
    // kept simple here since Phase 1 is single-organization.
    return { message: "Public profile endpoint - wires to OrganizationsService.getSettings() filtered to public fields." };
  }

  @Get("settings")
  @RequirePermissions("settings.manage")
  getSettings(@CurrentUser() user: AuthUser) {
    return this.organizationsService.getSettings(user.organizationId);
  }

  @Patch("settings")
  @RequirePermissions("settings.manage")
  @Audit({ action: "organization.settings.update", module: "settings" })
  updateSettings(@CurrentUser() user: AuthUser, @Body() dto: UpdateSettingsDto) {
    return this.organizationsService.updateSettings(user.organizationId, dto);
  }
}
