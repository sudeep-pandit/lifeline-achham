import { Controller, Get, Param, Patch } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "@lifeline/types";

// No @RequirePermissions here on purpose: notifications are personal to
// the logged-in user (whatever their role), not a permission-gated
// module - every authenticated user can read and clear their own.
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findAll(@CurrentUser() user: AuthUser) {
    if (user.permissions.includes("members.view") || user.isSuperAdmin) {
      await this.notificationsService.ensureExpiryNotifications(user.organizationId);
    }
    return this.notificationsService.findForUser(user.organizationId, user.id);
  }

  @Get("unread-count")
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notificationsService.unreadCount(user.organizationId, user.id);
  }

  @Patch(":id/read")
  markRead(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.notificationsService.markRead(user.organizationId, user.id, id);
  }

  @Patch("read-all")
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllRead(user.organizationId, user.id);
  }
}
