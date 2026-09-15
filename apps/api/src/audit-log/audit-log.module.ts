import { Global, Module } from "@nestjs/common";
import { AuditLogController } from "./audit-log.controller";
import { AuditLogService } from "./audit-log.service";

// Global so AuditLogInterceptor can inject AuditLogService from any module
// without every feature module importing AuditLogModule explicitly.
@Global()
@Module({
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
