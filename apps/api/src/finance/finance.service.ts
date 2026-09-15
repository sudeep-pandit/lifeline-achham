import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { UpsertCategoryDto } from "./dto/upsert-category.dto";
import { CreateIncomeDto } from "./dto/create-income.dto";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { NotificationsService } from "../notifications/notifications.service";

interface DateRange {
  from?: string;
  to?: string;
}

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // --- Categories (Sections 18-19: dynamic, Super Admin can add more) ---

  findIncomeCategories(organizationId: string, activeOnly = false) {
    return this.prisma.incomeCategory.findMany({
      where: { organizationId, isActive: activeOnly ? true : undefined },
      orderBy: { displayOrder: "asc" },
    });
  }

  createIncomeCategory(organizationId: string, dto: UpsertCategoryDto) {
    return this.prisma.incomeCategory.create({ data: { organizationId, ...dto } });
  }

  findExpenseCategories(organizationId: string, activeOnly = false) {
    return this.prisma.expenseCategory.findMany({
      where: { organizationId, isActive: activeOnly ? true : undefined },
      orderBy: { displayOrder: "asc" },
    });
  }

  createExpenseCategory(organizationId: string, dto: UpsertCategoryDto) {
    return this.prisma.expenseCategory.create({ data: { organizationId, ...dto } });
  }

  // --- Income ---

  async createIncome(organizationId: string, createdById: string, dto: CreateIncomeDto) {
    const category = await this.prisma.incomeCategory.findFirst({ where: { id: dto.categoryId, organizationId } });
    if (!category) throw new BadRequestException("Unknown income category");

    const incomeNumber = await this.organizationsService.nextSequenceNumber(organizationId, "income", "LA-INC");

    return this.prisma.income.create({
      data: {
        organizationId,
        incomeNumber,
        date: dto.date ? new Date(dto.date) : new Date(),
        categoryId: dto.categoryId,
        description: dto.description,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        referenceNumber: dto.referenceNumber,
        relatedMemberId: dto.relatedMemberId,
        remarks: dto.remarks,
        createdById,
        // Manually-entered income (donations, grants, etc.) requires
        // separate approval - only membership payments auto-approve
        // (see PaymentsService.markApplicationPaymentSuccess).
      },
    });
  }

  async approveIncome(organizationId: string, approverId: string, id: string) {
    const income = await this.prisma.income.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!income) throw new NotFoundException("Income entry not found");
    if (income.approvedAt) return income;
    return this.prisma.income.update({
      where: { id },
      data: { approvedById: approverId, approvedAt: new Date() },
    });
  }

  findIncome(organizationId: string, range: DateRange) {
    return this.prisma.income.findMany({
      where: {
        organizationId,
        deletedAt: null,
        date: this.dateFilter(range),
      },
      include: { category: true, relatedMember: { select: { memberId: true, fullName: true } }, createdBy: { select: { fullName: true } } },
      orderBy: { date: "desc" },
    });
  }

  // --- Expenses ---

  async createExpense(organizationId: string, createdById: string, dto: CreateExpenseDto) {
    const category = await this.prisma.expenseCategory.findFirst({ where: { id: dto.categoryId, organizationId } });
    if (!category) throw new BadRequestException("Unknown expense category");

    const expenseNumber = await this.organizationsService.nextSequenceNumber(organizationId, "expense", "LA-EXP");

    const expense = await this.prisma.expense.create({
      data: {
        organizationId,
        expenseNumber,
        date: dto.date ? new Date(dto.date) : new Date(),
        categoryId: dto.categoryId,
        description: dto.description,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        paidTo: dto.paidTo,
        billNumber: dto.billNumber,
        remarks: dto.remarks,
        createdById,
      },
    });

    await this.notificationsService.notifyByPermission(organizationId, "finance.approve", {
      type: "expense_pending_approval",
      title: "Expense awaiting approval",
      message: `${category.name} expense of ${dto.amount} (${expenseNumber}) needs approval`,
      link: `/dashboard/finance`,
      relatedRecordId: expense.id,
    });

    return expense;
  }

  async approveExpense(organizationId: string, approverId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!expense) throw new NotFoundException("Expense entry not found");
    if (expense.approvedAt) return expense;
    return this.prisma.expense.update({
      where: { id },
      data: { approvedById: approverId, approvedAt: new Date() },
    });
  }

  findExpenses(organizationId: string, range: DateRange) {
    return this.prisma.expense.findMany({
      where: {
        organizationId,
        deletedAt: null,
        date: this.dateFilter(range),
      },
      include: { category: true, createdBy: { select: { fullName: true } } },
      orderBy: { date: "desc" },
    });
  }

  // --- Accounting summary (Section 20) ---
  // Current Balance = Total Verified (approved) Income - Total Approved Expenses.
  // Deterministic and auditable: always computed fresh from approved rows,
  // never a stored/cached running total that could drift.
  async getSummary(organizationId: string) {
    const [totalIncomeAgg, totalExpenseAgg] = await Promise.all([
      this.prisma.income.aggregate({
        where: { organizationId, deletedAt: null, approvedAt: { not: null } },
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: { organizationId, deletedAt: null, approvedAt: { not: null } },
        _sum: { amount: true },
      }),
    ]);

    const totalIncome = totalIncomeAgg._sum.amount ?? 0;
    const totalExpense = totalExpenseAgg._sum.amount ?? 0;

    return {
      totalIncome: totalIncome.toString(),
      totalExpense: totalExpense.toString(),
      currentBalance: (Number(totalIncome) - Number(totalExpense)).toString(),
    };
  }

  private dateFilter(range: DateRange) {
    if (!range.from && !range.to) return undefined;
    return {
      gte: range.from ? new Date(range.from) : undefined,
      lte: range.to ? new Date(range.to) : undefined,
    };
  }
}
