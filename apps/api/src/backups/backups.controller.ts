import { Body, Controller, Get, Param, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { createReadStream } from "fs";
import { BackupsService } from "./backups.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Audit } from "../common/decorators/audit.decorator";
import type { AuthUser } from "@lifeline/types";

// Section 30: Settings -> Backup & Restore, Super Admin only for every
// action here (backups.manage is only granted to the super-admin role -
// see packages/config/src/permissions.ts).
@Controller("backups")
@RequirePermissions("backups.manage")
export class BackupsController {
  constructor(private readonly backupsService: BackupsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.backupsService.findAll(user.organizationId);
  }

  @Post()
  @Audit({ action: "backup.create", module: "backups" })
  create(@CurrentUser() user: AuthUser) {
    return this.backupsService.createBackup(user.organizationId, user.id, "MANUAL");
  }

  @Get(":id/download")
  async download(@CurrentUser() user: AuthUser, @Param("id") id: string, @Res() res: Response) {
    const backup = await this.backupsService.findOne(user.organizationId, id);
    if (backup.status !== "COMPLETED" || !backup.filePath) {
      res.status(400).json({ statusCode: 400, message: "This backup is not available for download" });
      return;
    }
    res.setHeader("Content-Type", "application/gzip");
    res.setHeader("Content-Disposition", `attachment; filename="${backup.filePath.split("/").pop()}"`);
    createReadStream(backup.filePath).pipe(res);
  }

  // Irreversible. The frontend requires typing the organization name to
  // confirm before this is ever called (see the Backups page).
  @Post(":id/restore")
  @Audit({ action: "backup.restore", module: "backups" })
  restore(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body("confirm") confirm?: string) {
    if (confirm !== "RESTORE") {
      return { restored: false, message: 'Pass { "confirm": "RESTORE" } to proceed - this overwrites the live database.' };
    }
    return this.backupsService.restore(user.organizationId, id);
  }
}
