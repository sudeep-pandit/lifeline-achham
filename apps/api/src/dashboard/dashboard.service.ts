import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { adToBs, dayOfWeek, formatAd } from "./nepali-date.util";
import type { AuthUser, DashboardSummaryDto } from "@lifeline/types";

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async getSummary(user: AuthUser): Promise<DashboardSummaryDto> {
    const org = await this.prisma.organization.findUnique({ where: { id: user.organizationId } });
    const settings = await this.prisma.organizationSettings.findUnique({ where: { organizationId: user.organizationId } });
    const now = new Date();
    const recent = await this.auditLogService.findAll(user.organizationId, 1, 10);

    const memberWhere = { organizationId: user.organizationId, deletedAt: null } as const;
    const expiringSoonDays = settings?.expiringSoonDays ?? 30;
    const expiringSoonBefore = new Date(now.getTime() + expiringSoonDays * 86400000);

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalMembers,
      lifetimeMembers,
      yearlyMembers,
      expiringMemberships,
      expiredMembers,
      pendingApplications,
      todaysIncomeAgg,
      monthlyIncomeAgg,
      monthlyExpenseAgg,
      totalIncomeAgg,
      totalExpenseAgg,
    ] = await this.prisma.$transaction([
      this.prisma.member.count({ where: memberWhere }),
      this.prisma.member.count({ where: { ...memberWhere, expiresAt: null } }),
      this.prisma.member.count({ where: { ...memberWhere, expiresAt: { not: null } } }),
      this.prisma.member.count({
        where: { ...memberWhere, expiresAt: { gte: now, lte: expiringSoonBefore } },
      }),
      this.prisma.member.count({ where: { ...memberWhere, expiresAt: { lt: now } } }),
      this.prisma.membershipApplication.count({
        where: { organizationId: user.organizationId, status: { in: ["SUBMITTED", "UNDER_REVIEW", "PAYMENT_SUCCESS"] } },
      }),
      this.prisma.income.aggregate({
        where: { organizationId: user.organizationId, deletedAt: null, approvedAt: { not: null }, date: { gte: startOfToday } },
        _sum: { amount: true },
      }),
      this.prisma.income.aggregate({
        where: { organizationId: user.organizationId, deletedAt: null, approvedAt: { not: null }, date: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: { organizationId: user.organizationId, deletedAt: null, approvedAt: { not: null }, date: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      this.prisma.income.aggregate({
        where: { organizationId: user.organizationId, deletedAt: null, approvedAt: { not: null } },
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: { organizationId: user.organizationId, deletedAt: null, approvedAt: { not: null } },
        _sum: { amount: true },
      }),
    ]);

    // Section 20: Current Balance = Total Verified Income - Total Approved
    // Expenses, computed fresh from approved rows every time (see
    // FinanceService.getSummary for the same formula, used by the Finance
    // page directly).
    const currentBalance = Number(totalIncomeAgg._sum.amount ?? 0) - Number(totalExpenseAgg._sum.amount ?? 0);

    return {
      organizationName: org?.name ?? "Lifeline Achham",
      greetingName: user.fullName,
      dateAD: formatAd(now),
      dateBS: adToBs(now),
      dayOfWeek: dayOfWeek(now),
      totalMembers,
      activeMembers: totalMembers - expiredMembers,
      lifetimeMembers,
      yearlyMembers,
      pendingApplications,
      expiringMemberships,
      todaysIncome: Number(todaysIncomeAgg._sum.amount ?? 0),
      monthlyIncome: Number(monthlyIncomeAgg._sum.amount ?? 0),
      monthlyExpenses: Number(monthlyExpenseAgg._sum.amount ?? 0),
      currentBalance,
      recentActivities: recent.items,
    };
  }
}
