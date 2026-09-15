import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { AuditLogService } from "../../audit-log/audit-log.service";
import { AUDIT_META_KEY, AuditMeta } from "../decorators/audit.decorator";
import { Reflector } from "@nestjs/core";

// Attach @Audit({ action, module }) to any write endpoint and this
// interceptor writes an immutable audit_logs row after a successful
// response (Section 27). Reads (GET) are intentionally not audited here
// to keep the log meaningful.
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditMeta | undefined>(AUDIT_META_KEY, context.getHandler());
    if (!meta) return next.handle();

    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap((result) => {
        void this.auditLogService.record({
          organizationId: request.user?.organizationId,
          userId: request.user?.id,
          action: meta.action,
          module: meta.module,
          recordId: result?.id ?? request.params?.id,
          newValue: meta.captureResult ? result : undefined,
          ipAddress: request.ip,
        });
      }),
    );
  }
}
