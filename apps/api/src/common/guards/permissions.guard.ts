import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import type { AuthUser } from "@lifeline/types";
import type { PermissionKey } from "@lifeline/config";

// Enforces @RequirePermissions(...) metadata against the authenticated
// user's flattened permission set. Super admins always pass. This guard
// runs AFTER JwtAuthGuard, so req.user is guaranteed to be populated.
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthUser | undefined = request.user;

    if (!user) throw new ForbiddenException("Not authenticated");
    if (user.isSuperAdmin) return true;

    const hasAll = required.every((perm) => user.permissions.includes(perm));
    if (!hasAll) {
      throw new ForbiddenException(
        `Missing required permission(s): ${required.filter((p) => !user.permissions.includes(p)).join(", ")}`,
      );
    }
    return true;
  }
}
