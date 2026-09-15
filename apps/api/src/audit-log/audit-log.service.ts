import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

interface RecordAuditInput {
  organizationId?: string;
  userId?: string;
  action: string;
  module: string;
  recordId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  // Audit logs are append-only (Section 27) - there is deliberately no
  // update()/delete() method on this service.
  async record(input: RecordAuditInput) {
    if (!input.organizationId) return; // system-level events without org context are skipped, not faked
    return this.prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: input.action,
        module: input.module,
        recordId: input.recordId,
        oldValue: input.oldValue as any,
        newValue: input.newValue as any,
        ipAddress: input.ipAddress,
      },
    });
  }

  async findAll(organizationId: string, page = 1, pageSize = 50) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where: { organizationId },
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where: { organizationId } }),
    ]);

    return {
      items: items.map((i) => ({
        id: i.id,
        userName: i.user?.fullName ?? "System",
        action: i.action,
        module: i.module,
        recordId: i.recordId,
        createdAt: i.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }
}
