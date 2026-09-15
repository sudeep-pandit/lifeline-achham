"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../../lib/api-client";
import { useAuth } from "../../../../lib/auth-context";
import { Card, CardLabel, CardValue } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Select } from "../../../../components/ui/select";
import type {
  FinanceCategoryDto,
  FinanceSummaryDto,
  IncomeListItemDto,
  ExpenseListItemDto,
  CreateIncomeRequest,
  CreateExpenseRequest,
} from "@lifeline/types";

type Tab = "income" | "expenses";

export default function FinancePage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<Tab>("income");
  const [summary, setSummary] = useState<FinanceSummaryDto | null>(null);

  const [incomeCategories, setIncomeCategories] = useState<FinanceCategoryDto[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<FinanceCategoryDto[]>([]);
  const [income, setIncome] = useState<IncomeListItemDto[] | null>(null);
  const [expenses, setExpenses] = useState<ExpenseListItemDto[] | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [incomeForm, setIncomeForm] = useState<CreateIncomeRequest>({ categoryId: "", amount: 0 });
  const [expenseForm, setExpenseForm] = useState<CreateExpenseRequest>({ categoryId: "", amount: 0 });

  function loadAll() {
    apiFetch<FinanceSummaryDto>("/finance/summary").then(setSummary).catch(() => {});
    apiFetch<FinanceCategoryDto[]>("/finance/income-categories").then(setIncomeCategories).catch(() => {});
    apiFetch<FinanceCategoryDto[]>("/finance/expense-categories").then(setExpenseCategories).catch(() => {});
    apiFetch<IncomeListItemDto[]>("/finance/income").then(setIncome).catch(() => setError("Unable to load finance data. You may not have permission to view this page."));
    apiFetch<ExpenseListItemDto[]>("/finance/expenses").then(setExpenses).catch(() => {});
  }

  useEffect(loadAll, []);

  async function submitIncome() {
    if (!incomeForm.categoryId || incomeForm.amount <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/finance/income", { method: "POST", body: JSON.stringify(incomeForm) });
      setIncomeForm({ categoryId: "", amount: 0 });
      loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to record this income.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitExpense() {
    if (!expenseForm.categoryId || expenseForm.amount <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/finance/expenses", { method: "POST", body: JSON.stringify(expenseForm) });
      setExpenseForm({ categoryId: "", amount: 0 });
      loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to record this expense.");
    } finally {
      setSubmitting(false);
    }
  }

  async function approve(kind: "income" | "expenses", id: string) {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/finance/${kind}/${id}/approve`, { method: "PATCH", body: JSON.stringify({}) });
      loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to approve this entry.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl text-navy dark:text-paper">Finance</h1>

      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardLabel>Total Verified Income</CardLabel>
            <CardValue>Rs. {summary.totalIncome}</CardValue>
          </Card>
          <Card>
            <CardLabel>Total Approved Expenses</CardLabel>
            <CardValue>Rs. {summary.totalExpense}</CardValue>
          </Card>
          <Card>
            <CardLabel>Current Balance</CardLabel>
            <CardValue>Rs. {summary.currentBalance}</CardValue>
          </Card>
        </div>
      )}

      <div className="flex gap-2 border-b border-navy-100 dark:border-navy-600">
        {(["income", "expenses"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize ${tab === t ? "border-b-2 border-crimson font-medium text-navy dark:text-paper" : "text-navy-400 dark:text-navy-100"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="text-crimson">{error}</p>}

      {tab === "income" && (
        <>
          {can("finance.income") && (
            <Card>
              <p className="mb-3 font-display text-lg text-navy dark:text-paper">Record income</p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Category</label>
                  <Select value={incomeForm.categoryId} onChange={(e) => setIncomeForm({ ...incomeForm, categoryId: e.target.value })}>
                    <option value="">Select…</option>
                    {incomeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </div>
                <Input
                  placeholder="Description"
                  value={incomeForm.description ?? ""}
                  onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })}
                  className="w-56"
                />
                <Input
                  type="number"
                  placeholder="Amount"
                  value={incomeForm.amount || ""}
                  onChange={(e) => setIncomeForm({ ...incomeForm, amount: Number(e.target.value) })}
                  className="w-32"
                />
                <Button disabled={submitting} onClick={submitIncome}>Add income</Button>
              </div>
            </Card>
          )}

          <Card className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-navy-100 text-navy-400 dark:border-navy-600 dark:text-navy-100">
                <tr>
                  <th className="px-4 py-3 font-medium">Income #</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(income ?? []).length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-navy-400 dark:text-navy-100">No income recorded.</td></tr>
                ) : (
                  income!.map((i) => (
                    <tr key={i.id} className="border-b border-navy-100 last:border-0 dark:border-navy-600">
                      <td className="px-4 py-3 font-medium text-navy dark:text-paper">{i.incomeNumber}</td>
                      <td className="px-4 py-3 text-navy-400 dark:text-navy-100">{new Date(i.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3">{i.category.name}</td>
                      <td className="px-4 py-3">{i.description ?? "—"}</td>
                      <td className="px-4 py-3">Rs. {i.amount}</td>
                      <td className="px-4 py-3">
                        {i.approvedAt ? (
                          <span className="text-sage">Approved</span>
                        ) : can("finance.approve") ? (
                          <button disabled={submitting} onClick={() => approve("income", i.id)} className="text-navy underline hover:text-crimson dark:text-paper">
                            Approve
                          </button>
                        ) : (
                          <span className="text-navy-400 dark:text-navy-100">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {tab === "expenses" && (
        <>
          {can("finance.expenses") && (
            <Card>
              <p className="mb-3 font-display text-lg text-navy dark:text-paper">Record expense</p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Category</label>
                  <Select value={expenseForm.categoryId} onChange={(e) => setExpenseForm({ ...expenseForm, categoryId: e.target.value })}>
                    <option value="">Select…</option>
                    {expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </div>
                <Input
                  placeholder="Paid to"
                  value={expenseForm.paidTo ?? ""}
                  onChange={(e) => setExpenseForm({ ...expenseForm, paidTo: e.target.value })}
                  className="w-40"
                />
                <Input
                  placeholder="Description"
                  value={expenseForm.description ?? ""}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className="w-56"
                />
                <Input
                  type="number"
                  placeholder="Amount"
                  value={expenseForm.amount || ""}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })}
                  className="w-32"
                />
                <Button disabled={submitting} onClick={submitExpense}>Add expense</Button>
              </div>
            </Card>
          )}

          <Card className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-navy-100 text-navy-400 dark:border-navy-600 dark:text-navy-100">
                <tr>
                  <th className="px-4 py-3 font-medium">Expense #</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Paid To</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(expenses ?? []).length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-navy-400 dark:text-navy-100">No expenses recorded.</td></tr>
                ) : (
                  expenses!.map((x) => (
                    <tr key={x.id} className="border-b border-navy-100 last:border-0 dark:border-navy-600">
                      <td className="px-4 py-3 font-medium text-navy dark:text-paper">{x.expenseNumber}</td>
                      <td className="px-4 py-3 text-navy-400 dark:text-navy-100">{new Date(x.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3">{x.category.name}</td>
                      <td className="px-4 py-3">{x.paidTo ?? "—"}</td>
                      <td className="px-4 py-3">Rs. {x.amount}</td>
                      <td className="px-4 py-3">
                        {x.approvedAt ? (
                          <span className="text-sage">Approved</span>
                        ) : can("finance.approve") ? (
                          <button disabled={submitting} onClick={() => approve("expenses", x.id)} className="text-navy underline hover:text-crimson dark:text-paper">
                            Approve
                          </button>
                        ) : (
                          <span className="text-navy-400 dark:text-navy-100">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
