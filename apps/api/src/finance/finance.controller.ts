import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { FinanceService } from "./finance.service";
import { UpsertCategoryDto } from "./dto/upsert-category.dto";
import { CreateIncomeDto } from "./dto/create-income.dto";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Audit } from "../common/decorators/audit.decorator";
import type { AuthUser } from "@lifeline/types";

@Controller("finance")
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get("summary")
  @RequirePermissions("finance.income")
  getSummary(@CurrentUser() user: AuthUser) {
    return this.financeService.getSummary(user.organizationId);
  }

  // --- Income categories ---
  @Get("income-categories")
  @RequirePermissions("finance.income")
  findIncomeCategories(@CurrentUser() user: AuthUser) {
    return this.financeService.findIncomeCategories(user.organizationId);
  }

  @Post("income-categories")
  @RequirePermissions("finance.income")
  @Audit({ action: "income_category.create", module: "finance" })
  createIncomeCategory(@CurrentUser() user: AuthUser, @Body() dto: UpsertCategoryDto) {
    return this.financeService.createIncomeCategory(user.organizationId, dto);
  }

  // --- Income ---
  @Get("income")
  @RequirePermissions("finance.income")
  findIncome(@CurrentUser() user: AuthUser, @Query("from") from?: string, @Query("to") to?: string) {
    return this.financeService.findIncome(user.organizationId, { from, to });
  }

  @Post("income")
  @RequirePermissions("finance.income")
  @Audit({ action: "income.create", module: "finance" })
  createIncome(@CurrentUser() user: AuthUser, @Body() dto: CreateIncomeDto) {
    return this.financeService.createIncome(user.organizationId, user.id, dto);
  }

  @Patch("income/:id/approve")
  @RequirePermissions("finance.approve")
  @Audit({ action: "income.approve", module: "finance" })
  approveIncome(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.financeService.approveIncome(user.organizationId, user.id, id);
  }

  // --- Expense categories ---
  @Get("expense-categories")
  @RequirePermissions("finance.expenses")
  findExpenseCategories(@CurrentUser() user: AuthUser) {
    return this.financeService.findExpenseCategories(user.organizationId);
  }

  @Post("expense-categories")
  @RequirePermissions("finance.expenses")
  @Audit({ action: "expense_category.create", module: "finance" })
  createExpenseCategory(@CurrentUser() user: AuthUser, @Body() dto: UpsertCategoryDto) {
    return this.financeService.createExpenseCategory(user.organizationId, dto);
  }

  // --- Expenses ---
  @Get("expenses")
  @RequirePermissions("finance.expenses")
  findExpenses(@CurrentUser() user: AuthUser, @Query("from") from?: string, @Query("to") to?: string) {
    return this.financeService.findExpenses(user.organizationId, { from, to });
  }

  @Post("expenses")
  @RequirePermissions("finance.expenses")
  @Audit({ action: "expense.create", module: "finance" })
  createExpense(@CurrentUser() user: AuthUser, @Body() dto: CreateExpenseDto) {
    return this.financeService.createExpense(user.organizationId, user.id, dto);
  }

  @Patch("expenses/:id/approve")
  @RequirePermissions("finance.approve")
  @Audit({ action: "expense.approve", module: "finance" })
  approveExpense(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.financeService.approveExpense(user.organizationId, user.id, id);
  }
}
