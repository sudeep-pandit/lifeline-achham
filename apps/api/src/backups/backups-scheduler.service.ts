import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { BackupsService } from "./backups.service";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

// Section 30: "Automatic daily backup". @Cron registers this on a fixed
// schedule at module init - the actual on/off switch is the
// BACKUP_AUTOMATIC_ENABLED check inside the method body, since @nestjs/schedule
// needs the cron expression at decorator-evaluation time (before
// ConfigService exists yet), not something that can be conditionally
// skipped. Reads process.env directly rather than ConfigService for the
// same reason - real OS-level env vars (e.g. set in Railway's dashboard)
// are already present by then; a local .env file loaded via dotenv/
// ConfigModule may not be yet, so local runs fall back to the hardcoded
// default schedule unless BACKUP_AUTOMATIC_CRON is set as a real
// environment variable rather than just a .env entry.
//
// Runs in-process, so it only fires while the API process is actually
// running - for production, pairing this with (or replacing it with) an
// external scheduler hitting POST /backups is a reasonable alternative if
// the process restarts frequently.
@Injectable()
export class BackupsSchedulerService {
  private readonly logger = new Logger(BackupsSchedulerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly backupsService: BackupsService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(process.env.BACKUP_AUTOMATIC_CRON || "0 2 * * *")
  async handleAutomaticBackup() {
    if (!this.config.get<boolean>("backup.automaticEnabled")) return;

    // Single-organization for now (see PaymentsController etc.) - a
    // multi-tenant deployment would loop over every organization here.
    const org = await this.prisma.organization.findUnique({ where: { id: DEFAULT_ORG_ID } });
    if (!org) return;
    this.logger.log(`Running automatic backup for ${org.name}`);
    await this.backupsService.createBackup(org.id, null, "AUTOMATIC");
  }
}
