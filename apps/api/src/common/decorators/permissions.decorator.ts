import { SetMetadata } from "@nestjs/common";
import type { PermissionKey } from "@lifeline/config";

export const PERMISSIONS_KEY = "permissions";

// Usage: @RequirePermissions("members.view", "members.edit")
// A route decorated this way requires the current user to hold ALL listed
// permissions (via their role(s), or be isSuperAdmin).
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
