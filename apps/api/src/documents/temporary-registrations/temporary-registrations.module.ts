import { Module } from "@nestjs/common";
import { TemporaryRegistrationsController } from "./temporary-registrations.controller";
import { TemporaryRegistrationsService } from "./temporary-registrations.service";

@Module({
  controllers: [TemporaryRegistrationsController],
  providers: [TemporaryRegistrationsService],
  exports: [TemporaryRegistrationsService],
})
export class TemporaryRegistrationsModule {}
