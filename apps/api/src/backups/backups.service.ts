import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { exec } from "child_process";
import { promisify } from "util";
import { mkdir, stat } from "fs/promises";
import { join } from "path";
import type { BackupType } from "@prisma/client";

const execAsync = promisify(exec);

// Section 30: manual/scheduled backup + restore, restricted to Super Admin.
// Shells out to the standard PostgreSQL client tools (pg_dump/psql) against
// DATABASE_URL, rather than reimplementing a dump format - these tools are
// the reliable, officially-supported way to do this and ship with any
// Postgres client install. This has NOT been run end-to-end in the sandbox
// that built this (no Postgres/pg_dump available there); the command
// construction is correct, standard usage but should be smoke-tested
// against your actual deployment before relying on it.
@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private backupDir(): string {
    return this.config.get<string>("backup.dir") ?? "./backups";
  }

  async createBackup(organizationId: string, createdById: string | null, type: BackupType = "MANUAL") {
    const dir = this.backupDir();
    await mkdir(dir, { recursive: true });

    const record = await this.prisma.backup.create({
      data: { organizationId, type, status: "IN_PROGRESS", createdById: createdById ?? undefined },
    });

    const filename = `backup-${record.id}-${new Date().toISOString().replace(/[:.]/g, "-")}.sql.gz`;
    const filePath = join(dir, filename);
    const databaseUrl = this.config.get<string>("database.url");

    if (!databaseUrl) {
      return this.prisma.backup.update({
        where: { id: record.id },
        data: { status: "FAILED", errorMessage: "DATABASE_URL is not configured", completedAt: new Date() },
      });
    }

    try {
      // pg_dump streamed through gzip - keeps backup files small without
      // needing a separate compression pass.
      await execAsync(`pg_dump "${databaseUrl}" | gzip > "${filePath}"`, { shell: "/bin/bash" });
      const stats = await stat(filePath);

      return await this.prisma.backup.update({
        where: { id: record.id },
        data: { status: "COMPLETED", filePath, fileSizeBytes: stats.size, completedAt: new Date() },
      });
    } catch (err) {
      this.logger.error(`Backup ${record.id} failed`, err as Error);
      return this.prisma.backup.update({
        where: { id: record.id },
        data: {
          status: "FAILED",
          errorMessage: "pg_dump failed - is the PostgreSQL client installed on this host? See logs for details.",
          completedAt: new Date(),
        },
      });
    }
  }

  findAll(organizationId: string) {
    return this.prisma.backup.findMany({
      where: { organizationId },
      include: { createdBy: { select: { fullName: true } } },
      orderBy: { startedAt: "desc" },
    });
  }

  async findOne(organizationId: string, id: string) {
    const backup = await this.prisma.backup.findFirst({ where: { id, organizationId } });
    if (!backup) throw new NotFoundException("Backup not found");
    return backup;
  }

  // Deliberately destructive and irreversible - the controller restricts
  // this to Super Admin only (Section 30: "Restrict restore functionality
  // to Super Admin"), and the frontend requires typing a confirmation
  // phrase before calling it.
  async restore(organizationId: string, id: string) {
    const backup = await this.findOne(organizationId, id);
    if (backup.status !== "COMPLETED" || !backup.filePath) {
      throw new BadRequestException("Only a completed backup can be restored");
    }

    const databaseUrl = this.config.get<string>("database.url");
    if (!databaseUrl) throw new BadRequestException("DATABASE_URL is not configured");

    try {
      await execAsync(`gunzip -c "${backup.filePath}" | psql "${databaseUrl}"`, { shell: "/bin/bash" });
      return { restored: true };
    } catch (err) {
      this.logger.error(`Restore of backup ${id} failed`, err as Error);
      throw new BadRequestException("Restore failed - is the PostgreSQL client installed on this host? See server logs for details.");
    }
  }
}
