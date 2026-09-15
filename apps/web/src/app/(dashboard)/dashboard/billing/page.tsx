"use client";

import { useEffect, useState } from "react";
import { apiFetch, downloadPdf, ApiError } from "../../../../lib/api-client";
import { useAuth } from "../../../../lib/auth-context";
import { Card } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Select } from "../../../../components/ui/select";
import { StatusBadge } from "../../../../components/ui/badge";
import type { MemberListItemDto, PaymentListItemDto, CreateMemberBillRequest } from "@lifeline/types";

// Section: Billing. Member -> Membership -> Bill -> Payment -> Receipt,
// for members who never went through an online application (walk-ins
// added via "Add Member") - reuses the same Payment/Receipt machinery as
// the application flow, just linked to a member directly instead.
export default function BillingPage() {
  const { can } = useAuth();
  const [members, setMembers] = useState<MemberListItemDto[]>([]);
  const [bills, setBills] = useState<PaymentListItemDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  const [form, setForm] = useState<CreateMemberBillRequest>({ memberId: "", method: "CASH" });

  function loadBills() {
    apiFetch<PaymentListItemDto[]>("/payments")
      .then((all) => setBills(all.filter((p) => p.member)))
      .catch(() => setError("Unable to load bills. You may not have permission to view this page."));
  }

  useEffect(() => {
    loadBills();
    apiFetch<{ items: MemberListItemDto[] }>("/members?pageSize=200").then((d) => setMembers(d.items)).catch(() => {});
  }, []);

  async function createBill() {
    if (!form.memberId) {
      setError("Select a member.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/payments/member-bill", { method: "POST", body: JSON.stringify(form) });
      setForm({ memberId: "", method: "CASH" });
      loadBills();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create this bill.");
    } finally {
      setSubmitting(false);
    }
  }

  async function verify(id: string) {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/payments/member-bill/${id}/verify`, { method: "PATCH", body: JSON.stringify({}) });
      loadBills();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to verify this bill.");
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadReceipt(id: string) {
    setGenerating(id);
    setError(null);
    try {
      await downloadPdf(`/documents/receipts/${id}/pdf`, "receipt.pdf");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to generate this receipt.");
    } finally {
      setGenerating(null);
    }
  }

  const selectedMember = members.find((m) => m.id === form.memberId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl text-navy dark:text-paper">Billing</h1>

      {can("payments.create") && (
        <Card>
          <p className="mb-3 font-display text-lg text-navy dark:text-paper">Create a bill</p>
          <p className="mb-4 text-sm text-navy-400 dark:text-navy-100">
            For a member registered directly (no online application) - e.g. a walk-in. Amount defaults
            to their membership fee.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Member</label>
              <Select value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })} className="w-64">
                <option value="">Select…</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.memberId} — {m.fullName}</option>)}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Amount</label>
              <Input
                type="number"
                placeholder={selectedMember ? "Membership fee" : "Amount"}
                value={form.amount ?? ""}
                onChange={(e) => setForm({ ...form, amount: e.target.value ? Number(e.target.value) : undefined })}
                className="w-32"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Method</label>
              <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as CreateMemberBillRequest["method"] })}>
                <option value="CASH">Cash</option>
                <option value="BANK_DEPOSIT">Bank Deposit</option>
                <option value="CHEQUE">Cheque</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
            <Input
              placeholder="Reference no. (optional)"
              value={form.offlineReference ?? ""}
              onChange={(e) => setForm({ ...form, offlineReference: e.target.value })}
              className="w-40"
            />
            <Button disabled={submitting} onClick={createBill}>Create bill</Button>
          </div>
        </Card>
      )}

      {error && <p className="text-crimson">{error}</p>}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-navy-100 text-navy-400 dark:border-navy-600 dark:text-navy-100">
            <tr>
              <th className="px-4 py-3 font-medium">Bill #</th>
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Method</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(bills ?? []).length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-navy-400 dark:text-navy-100">No bills recorded yet.</td></tr>
            ) : (
              bills!.map((b) => (
                <tr key={b.id} className="border-b border-navy-100 last:border-0 dark:border-navy-600">
                  <td className="px-4 py-3 font-medium text-navy dark:text-paper">{b.paymentNumber}</td>
                  <td className="px-4 py-3">{b.member?.memberId} — {b.member?.fullName}</td>
                  <td className="px-4 py-3">{b.method.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3">Rs. {b.amount}</td>
                  <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3 text-xs">
                      {b.status === "PENDING" && can("payments.verify") && (
                        <button disabled={submitting} onClick={() => verify(b.id)} className="text-navy underline hover:text-crimson dark:text-paper">
                          Verify
                        </button>
                      )}
                      {(b.status === "PAID" || b.status === "MANUALLY_VERIFIED") && can("documents.receipts") && (
                        <button disabled={generating === b.id} onClick={() => downloadReceipt(b.id)} className="text-navy underline hover:text-crimson dark:text-paper">
                          {generating === b.id ? "Generating…" : "Receipt"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
