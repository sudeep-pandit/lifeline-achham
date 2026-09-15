import { Controller, Get, Query } from "@nestjs/common";
import { AuditLogService } from "./audit-log.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "@lifeline/types";

@Controller("audit-logs")
@RequirePermissions("audit_logs.view")
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.auditLogService.findAll(user.organizationId, Number(page) || 1, Number(pageSize) || 50);
  }
}
