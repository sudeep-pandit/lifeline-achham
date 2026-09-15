import { Controller, Get } from "@nestjs/common";
import { PermissionsService } from "./permissions.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";

// Read-only catalogue endpoint, used by the "create/edit role" screen to
// render the full permission checklist grouped by module.
@Controller("permissions")
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @RequirePermissions("roles.manage")
  findAll() {
    return this.permissionsService.findAll();
  }
}
