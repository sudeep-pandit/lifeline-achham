import { Module } from "@nestjs/common";
import { NepalDataController } from "./nepal-data.controller";
import { NepalDataService } from "./nepal-data.service";

@Module({
  controllers: [NepalDataController],
  providers: [NepalDataService],
  exports: [NepalDataService],
})
export class NepalDataModule {}
