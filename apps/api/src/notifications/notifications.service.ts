import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

interface NotifyInput {
  type: string;
  title: string;
  message: string;
  link?: string;
  relatedRecordId?: string;
}

// Section 25: in-app notifications now; deliberately designed so
// email/SMS/WhatsApp delivery can be added later as additional "channels"
// this same service calls out to, without changing any call site below.
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notifyUser(organizationId: string, userId: string, input: NotifyInput) {
    return this.prisma.notification.create({
      data: { organizationId, userId, ...input },
    });
  }

  // Broadcasts to every active user in the org who holds the given
  // permission (directly, via their role, or via isSuperAdmin) - e.g.
  // "applications.review" reaches every Admin without hard-coding role
  // names here.
  async notifyByPermission(organizationId: string, permissionKey: string, input: NotifyInput) {
    const users = await this.prisma.user.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        deletedAt: null,
        OR: [
          { isSuperAdmin: true },
          { roles: { some: { role: { permissions: { some: { permission: { key: permissionKey } } } } } } },
        ],
      },
      select: { id: true },
    });

    if (users.length === 0) return;

    // Dedupe: if a relatedRecordId is given, skip users who already have a
    // notification of this type for this record (avoids re-notifying on
    // retried operations).
    let alreadyNotified = new Set<string>();
    if (input.relatedRecordId) {
      const existing = await this.prisma.notification.findMany({
        where: { organizationId, type: input.type, relatedRecordId: input.relatedRecordId },
        select: { userId: true },
      });
      alreadyNotified = new Set(existing.map((e) => e.userId));
    }

    const targets = users.filter((u) => !alreadyNotified.has(u.id));
    if (targets.length === 0) return;

    await this.prisma.notification.createMany({
      data: targets.map((u) => ({ organizationId, userId: u.id, ...input })),
    });
  }

  findForUser(organizationId: string, userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { organizationId, userId, isRead: unreadOnly ? false : undefined },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  unreadCount(organizationId: string, userId: string) {
    return this.prisma.notification.count({ where: { organizationId, userId, isRead: false } });
  }

  async markRead(organizationId: string, userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, organizationId, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(organizationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { organizationId, userId, isRead: false },
      data: { isRead: true },
    });
  }

  // Lazily generates "membership expiring soon" notifications the first
  // time anyone with members.view checks their notifications each day,
  // rather than requiring a cron process to exist just for this. One
  // notification per expiring member per organization, deduped via
  // relatedRecordId so it's never repeated.
  async ensureExpiryNotifications(organizationId: string) {
    const settings = await this.prisma.organizationSettings.findUnique({ where: { organizationId } });
    const expiringSoonDays = settings?.expiringSoonDays ?? 30;
    const now = new Date();
    const soonThreshold = new Date(now.getTime() + expiringSoonDays * 24 * 60 * 60 * 1000);

    const expiring = await this.prisma.member.findMany({
      where: { organizationId, deletedAt: null, expiresAt: { gte: now, lte: soonThreshold } },
      select: { id: true, memberId: true, fullName: true, expiresAt: true },
    });

    for (const member of expiring) {
      await this.notifyByPermission(organizationId, "members.view", {
        type: "membership_expiring",
        title: "Membership expiring soon",
        message: `${member.fullName} (${member.memberId}) expires on ${member.expiresAt!.toLocaleDateString()}`,
        link: `/dashboard/members`,
        relatedRecordId: member.id,
      });
    }
  }
}
