import { SetMetadata } from "@nestjs/common";

export const AUDIT_META_KEY = "audit_meta";

export interface AuditMeta {
  action: string;   // "member.create"
  module: string;   // "members"
  captureResult?: boolean;
}

export const Audit = (meta: AuditMeta) => SetMetadata(AUDIT_META_KEY, meta);
