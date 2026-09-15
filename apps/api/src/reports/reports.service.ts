import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { ReportColumn, ReportData } from "./report-table-pdf.util";

interface RangeFilter {
  from?: string;
  to?: string;
}

function money(n: unknown): string {
  return Number(n ?? 0).toFixed(2);
}

function rangeLabel(range: RangeFilter): string | undefined {
  if (!range.from && !range.to) return undefined;
  return `${range.from ?? "…"} to ${range.to ?? "…"}`;
}

function dateRangeWhere(range: RangeFilter) {
  if (!range.from && !range.to) return undefined;
  return { gte: range.from ? new Date(range.from) : undefined, lte: range.to ? new Date(range.to) : undefined };
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // =====================================================================
  // MEMBER REPORTS (Section 21)
  // =====================================================================

  async memberReport(organizationId: string, view: string, range: RangeFilter): Promise<ReportData> {
    const columns: ReportColumn[] = [
      { key: "memberId", label: "Member ID", width: 80 },
      { key: "name", label: "Name", width: 130 },
      { key: "type", label: "Type", width: 90 },
      { key: "district", label: "District", width: 90 },
      { key: "status", label: "Status", width: 70 },
      { key: "date", label: "Membership Date", width: 90 },
    ];

    const where: any = { organizationId, deletedAt: null };
    if (range.from || range.to) where.membershipDate = dateRangeWhere(range);

    const now = new Date();
    if (view === "active") where.OR = [{ expiresAt: null }, { expiresAt: { gte: now } }];
    if (view === "expired") where.expiresAt = { lt: now };
    if (view === "lifetime") where.expiresAt = null;
    if (view === "yearly") where.expiresAt = { not: null };

    const members = await this.prisma.member.findMany({
      where,
      include: { membershipType: true, district: true },
      orderBy: { membershipDate: "desc" },
    });

    const rows = members.map((m) => ({
      memberId: m.memberId,
      name: m.fullName,
      type: m.membershipType.name,
      district: m.district.name,
      status: !m.expiresAt ? "Lifetime" : m.expiresAt < now ? "Expired" : "Active",
      date: m.membershipDate.toISOString().slice(0, 10),
    }));

    return {
      title: `Member Report — ${view.replace(/-/g, " ")}`,
      dateRangeLabel: rangeLabel(range),
      columns,
      rows,
      summaryLines: [`Total members: ${rows.length}`],
    };
  }

  async membersByGeography(organizationId: string, level: "district" | "municipality" | "ward"): Promise<ReportData> {
    const members = await this.prisma.member.findMany({
      where: { organizationId, deletedAt: null },
      include: { district: true, municipality: true },
    });

    const groupKey = (m: (typeof members)[number]) =>
      level === "district" ? m.district.name : level === "municipality" ? m.municipality.name : `Ward ${m.wardNo}`;

    const counts = new Map<string, number>();
    for (const m of members) {
      const key = groupKey(m);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const rows = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count: String(count) }));

    return {
      title: `Members by ${level}`,
      columns: [
        { key: "name", label: level === "ward" ? "Ward" : level[0].toUpperCase() + level.slice(1), width: 300 },
        { key: "count", label: "Members", width: 100 },
      ],
      rows,
      summaryLines: [`Total members: ${members.length}`],
    };
  }

  async membersByType(organizationId: string): Promise<ReportData> {
    const groups = await this.prisma.member.groupBy({
      by: ["membershipTypeId"],
      where: { organizationId, deletedAt: null },
      _count: { _all: true },
    });
    const types = await this.prisma.membershipType.findMany({ where: { organizationId } });
    const rows = groups.map((g) => ({
      type: types.find((t) => t.id === g.membershipTypeId)?.name ?? "Unknown",
      count: String(g._count._all),
    }));
    return {
      title: "Members by Membership Type",
      columns: [
        { key: "type", label: "Membership Type", width: 300 },
        { key: "count", label: "Members", width: 100 },
      ],
      rows,
      summaryLines: [`Total members: ${rows.reduce((s, r) => s + Number(r.count), 0)}`],
    };
  }

  // =====================================================================
  // FINANCIAL REPORTS (Section 21)
  // =====================================================================

  async incomeReport(organizationId: string, range: RangeFilter): Promise<ReportData> {
    const entries = await this.prisma.income.findMany({
      where: { organizationId, deletedAt: null, date: dateRangeWhere(range) },
      include: { category: true },
      orderBy: { date: "desc" },
    });
    const total = entries.reduce((s, e) => s + Number(e.amount), 0);
    return {
      title: "Income Report",
      dateRangeLabel: rangeLabel(range),
      columns: [
        { key: "number", label: "Income #", width: 90 },
        { key: "date", label: "Date", width: 70 },
        { key: "category", label: "Category", width: 100 },
        { key: "description", label: "Description", width: 150 },
        { key: "amount", label: "Amount", width: 80 },
        { key: "status", label: "Status", width: 60 },
      ],
      rows: entries.map((e) => ({
        number: e.incomeNumber,
        date: e.date.toISOString().slice(0, 10),
        category: e.category.name,
        description: e.description ?? "",
        amount: money(e.amount),
        status: e.approvedAt ? "Approved" : "Pending",
      })),
      summaryLines: [`Total income: ${money(total)}`],
    };
  }

  async expenseReport(organizationId: string, range: RangeFilter): Promise<ReportData> {
    const entries = await this.prisma.expense.findMany({
      where: { organizationId, deletedAt: null, date: dateRangeWhere(range) },
      include: { category: true },
      orderBy: { date: "desc" },
    });
    const total = entries.reduce((s, e) => s + Number(e.amount), 0);
    return {
      title: "Expense Report",
      dateRangeLabel: rangeLabel(range),
      columns: [
        { key: "number", label: "Expense #", width: 90 },
        { key: "date", label: "Date", width: 70 },
        { key: "category", label: "Category", width: 100 },
        { key: "paidTo", label: "Paid To", width: 110 },
        { key: "amount", label: "Amount", width: 80 },
        { key: "status", label: "Status", width: 60 },
      ],
      rows: entries.map((e) => ({
        number: e.expenseNumber,
        date: e.date.toISOString().slice(0, 10),
        category: e.category.name,
        paidTo: e.paidTo ?? "",
        amount: money(e.amount),
        status: e.approvedAt ? "Approved" : "Pending",
      })),
      summaryLines: [`Total expenses: ${money(total)}`],
    };
  }

  async incomeVsExpenses(organizationId: string, range: RangeFilter): Promise<ReportData> {
    const [income, expenses] = await Promise.all([
      this.prisma.income.findMany({ where: { organizationId, deletedAt: null, approvedAt: { not: null }, date: dateRangeWhere(range) } }),
      this.prisma.expense.findMany({ where: { organizationId, deletedAt: null, approvedAt: { not: null }, date: dateRangeWhere(range) } }),
    ]);

    const byMonth = new Map<string, { income: number; expense: number }>();
    const bump = (date: Date, field: "income" | "expense", amount: number) => {
      const key = date.toISOString().slice(0, 7);
      const entry = byMonth.get(key) ?? { income: 0, expense: 0 };
      entry[field] += amount;
      byMonth.set(key, entry);
    };
    income.forEach((i) => bump(i.date, "income", Number(i.amount)));
    expenses.forEach((e) => bump(e.date, "expense", Number(e.amount)));

    const rows = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        income: money(v.income),
        expense: money(v.expense),
        net: money(v.income - v.expense),
      }));

    const totalIncome = income.reduce((s, i) => s + Number(i.amount), 0);
    const totalExpense = expenses.reduce((s, e) => s + Number(e.amount), 0);

    return {
      title: "Income vs Expenses",
      dateRangeLabel: rangeLabel(range),
      columns: [
        { key: "month", label: "Month", width: 100 },
        { key: "income", label: "Income", width: 120 },
        { key: "expense", label: "Expense", width: 120 },
        { key: "net", label: "Net", width: 120 },
      ],
      rows,
      summaryLines: [
        `Total income: ${money(totalIncome)}`,
        `Total expenses: ${money(totalExpense)}`,
        `Net: ${money(totalIncome - totalExpense)}`,
      ],
    };
  }

  async collectionReport(organizationId: string, granularity: "daily" | "monthly" | "yearly", range: RangeFilter): Promise<ReportData> {
    const payments = await this.prisma.payment.findMany({
      where: { organizationId, status: { in: ["PAID", "MANUALLY_VERIFIED"] }, createdAt: dateRangeWhere(range) },
    });

    const keyFor = (d: Date) =>
      granularity === "daily" ? d.toISOString().slice(0, 10) : granularity === "monthly" ? d.toISOString().slice(0, 7) : d.getFullYear().toString();

    const totals = new Map<string, number>();
    for (const p of payments) {
      const key = keyFor(p.verifiedAt ?? p.createdAt);
      totals.set(key, (totals.get(key) ?? 0) + Number(p.amount));
    }

    const rows = Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, amount]) => ({ period, amount: money(amount) }));

    return {
      title: `${granularity[0].toUpperCase() + granularity.slice(1)} Collection`,
      dateRangeLabel: rangeLabel(range),
      columns: [
        { key: "period", label: granularity === "daily" ? "Date" : granularity === "monthly" ? "Month" : "Year", width: 150 },
        { key: "amount", label: "Amount Collected", width: 150 },
      ],
      rows,
      summaryLines: [`Total collected: ${money(payments.reduce((s, p) => s + Number(p.amount), 0))}`],
    };
  }

  async membershipRevenue(organizationId: string, range: RangeFilter): Promise<ReportData> {
    const entries = await this.prisma.income.findMany({
      where: { organizationId, deletedAt: null, category: { name: "Membership" }, date: dateRangeWhere(range) },
      include: { relatedMember: { select: { memberId: true, fullName: true } } },
      orderBy: { date: "desc" },
    });
    const total = entries.reduce((s, e) => s + Number(e.amount), 0);
    return {
      title: "Membership Revenue",
      dateRangeLabel: rangeLabel(range),
      columns: [
        { key: "date", label: "Date", width: 80 },
        { key: "member", label: "Member", width: 150 },
        { key: "amount", label: "Amount", width: 100 },
      ],
      rows: entries.map((e) => ({
        date: e.date.toISOString().slice(0, 10),
        member: e.relatedMember ? `${e.relatedMember.memberId} — ${e.relatedMember.fullName}` : "—",
        amount: money(e.amount),
      })),
      summaryLines: [`Total membership revenue: ${money(total)}`],
    };
  }

  async paymentMethodReport(organizationId: string, range: RangeFilter): Promise<ReportData> {
    const payments = await this.prisma.payment.findMany({
      where: { organizationId, status: { in: ["PAID", "MANUALLY_VERIFIED"] }, createdAt: dateRangeWhere(range) },
    });
    const totals = new Map<string, { count: number; amount: number }>();
    for (const p of payments) {
      const entry = totals.get(p.method) ?? { count: 0, amount: 0 };
      entry.count += 1;
      entry.amount += Number(p.amount);
      totals.set(p.method, entry);
    }
    const rows = Array.from(totals.entries()).map(([method, v]) => ({
      method: method.replace(/_/g, " "),
      count: String(v.count),
      amount: money(v.amount),
    }));
    return {
      title: "Payments by Method",
      dateRangeLabel: rangeLabel(range),
      columns: [
        { key: "method", label: "Method", width: 150 },
        { key: "count", label: "Count", width: 80 },
        { key: "amount", label: "Amount", width: 120 },
      ],
      rows,
      summaryLines: [`Total collected: ${money(payments.reduce((s, p) => s + Number(p.amount), 0))}`],
    };
  }

  async outstandingBalanceReport(organizationId: string): Promise<ReportData> {
    const applications = await this.prisma.membershipApplication.findMany({
      where: { organizationId, status: { in: ["PAYMENT_PENDING", "PAYMENT_FAILED"] } },
      include: { membershipType: true },
      orderBy: { createdAt: "desc" },
    });
    const total = applications.reduce((s, a) => s + Number(a.membershipFee), 0);
    return {
      title: "Outstanding Balance (Unpaid Applications)",
      columns: [
        { key: "number", label: "Application #", width: 100 },
        { key: "name", label: "Applicant", width: 150 },
        { key: "type", label: "Type", width: 100 },
        { key: "status", label: "Status", width: 90 },
        { key: "fee", label: "Fee Due", width: 80 },
      ],
      rows: applications.map((a) => ({
        number: a.applicationNumber,
        name: a.fullName,
        type: a.membershipType.name,
        status: a.status.replace(/_/g, " "),
        fee: money(a.membershipFee),
      })),
      summaryLines: [`Total outstanding: ${money(total)}`],
    };
  }

  // =====================================================================
  // ADMINISTRATIVE REPORTS (Section 21)
  // =====================================================================

  async userActivityReport(organizationId: string, range: RangeFilter): Promise<ReportData> {
    const logs = await this.prisma.auditLog.findMany({
      where: { organizationId, createdAt: dateRangeWhere(range) },
      include: { user: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 500, // reports are for review, not a full export dump
    });
    return {
      title: "User Activity",
      dateRangeLabel: rangeLabel(range),
      columns: [
        { key: "user", label: "User", width: 110 },
        { key: "action", label: "Action", width: 130 },
        { key: "module", label: "Module", width: 90 },
        { key: "date", label: "Date", width: 130 },
      ],
      rows: logs.map((l) => ({
        user: l.user?.fullName ?? "System",
        action: l.action,
        module: l.module,
        date: l.createdAt.toLocaleString(),
      })),
      summaryLines: [`Showing ${logs.length} most recent activities${logs.length === 500 ? " (capped at 500)" : ""}`],
    };
  }

  async applicationsByStatus(organizationId: string, status: "APPROVED" | "REJECTED" | "PAYMENT_PENDING" | "SUBMITTED" | "UNDER_REVIEW"): Promise<ReportData> {
    const applications = await this.prisma.membershipApplication.findMany({
      where: { organizationId, status },
      include: { membershipType: true, reviewedBy: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    });
    return {
      title: `Applications — ${status.replace(/_/g, " ")}`,
      columns: [
        { key: "number", label: "Application #", width: 90 },
        { key: "name", label: "Applicant", width: 140 },
        { key: "type", label: "Type", width: 90 },
        { key: "reviewedBy", label: "Reviewed By", width: 100 },
        { key: "date", label: "Submitted", width: 80 },
      ],
      rows: applications.map((a) => ({
        number: a.applicationNumber,
        name: a.fullName,
        type: a.membershipType.name,
        reviewedBy: a.reviewedBy?.fullName ?? "—",
        date: a.createdAt.toISOString().slice(0, 10),
      })),
      summaryLines: [`Total: ${applications.length}`],
    };
  }

  async generatedDocumentsReport(organizationId: string, kind: "cards" | "certificates" | "receipts"): Promise<ReportData> {
    if (kind === "receipts") {
      const payments = await this.prisma.payment.findMany({
        where: { organizationId, receiptNumber: { not: null } },
        include: {
          application: { select: { fullName: true } },
          member: { select: { fullName: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return {
        title: "Generated Receipts",
        columns: [
          { key: "number", label: "Receipt #", width: 100 },
          { key: "name", label: "Customer", width: 150 },
          { key: "amount", label: "Amount", width: 100 },
        ],
        rows: payments.map((p) => ({
          number: p.receiptNumber ?? "",
          name: p.application?.fullName ?? p.member?.fullName ?? "—",
          amount: money(p.amount),
        })),
        summaryLines: [`Total: ${payments.length}`],
      };
    }

    const members = await this.prisma.member.findMany({
      where:
        kind === "cards"
          ? { organizationId, deletedAt: null, cardNumber: { not: null } }
          : { organizationId, deletedAt: null, certificateNumber: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    return {
      title: kind === "cards" ? "Generated Membership Cards" : "Generated Certificates",
      columns: [
        { key: "number", label: kind === "cards" ? "Card #" : "Certificate #", width: 100 },
        { key: "memberId", label: "Member ID", width: 90 },
        { key: "name", label: "Name", width: 150 },
      ],
      rows: members.map((m) => ({
        number: (kind === "cards" ? m.cardNumber : m.certificateNumber) ?? "",
        memberId: m.memberId,
        name: m.fullName,
      })),
      summaryLines: [`Total: ${members.length}`],
    };
  }
}
