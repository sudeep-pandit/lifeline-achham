import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { BackupsController } from "./backups.controller";
import { BackupsService } from "./backups.service";
import { BackupsSchedulerService } from "./backups-scheduler.service";

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [BackupsController],
  providers: [BackupsService, BackupsSchedulerService],
  exports: [BackupsService],
})
export class BackupsModule {}
