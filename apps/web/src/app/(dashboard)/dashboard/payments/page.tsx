"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, downloadPdf, ApiError } from "../../../../lib/api-client";
import { useAuth } from "../../../../lib/auth-context";
import { Card } from "../../../../components/ui/card";
import { Select } from "../../../../components/ui/select";
import { StatusBadge } from "../../../../components/ui/badge";
import type { PaymentListItemDto } from "@lifeline/types";

// Section 15/21: a running ledger of every payment attempt (online and
// offline), plus receipt downloads for anything paid/verified - this is
// where "Receipts" in the spec's sidebar grouping actually lives, rather
// than a separate page duplicating this same list.
export default function PaymentsPage() {
  const { can } = useAuth();
  const [items, setItems] = useState<PaymentListItemDto[] | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    const params = status ? `?status=${status}` : "";
    apiFetch<PaymentListItemDto[]>(`/payments${params}`)
      .then(setItems)
      .catch(() => setError("Unable to load payments. You may not have permission to view this page."));
  }, [status]);

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-navy dark:text-paper">Payments</h1>
        <div className="w-56">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="MANUALLY_VERIFIED">Manually verified</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </Select>
        </div>
      </div>

      {error && <p className="text-crimson">{error}</p>}

      {items && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-navy-100 text-navy-400 dark:border-navy-600 dark:text-navy-100">
              <tr>
                <th className="px-4 py-3 font-medium">Payment #</th>
                <th className="px-4 py-3 font-medium">Applicant</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Recorded</th>
                {can("documents.receipts") && <th className="px-4 py-3 font-medium">Receipt</th>}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-navy-400 dark:text-navy-100">
                    No payments found.
                  </td>
                </tr>
              ) : (
                items.map((p) => (
                  <tr key={p.id} className="border-b border-navy-100 last:border-0 dark:border-navy-600">
                    <td className="px-4 py-3 font-medium text-navy dark:text-paper">{p.paymentNumber}</td>
                    <td className="px-4 py-3">
                      {p.application ? (
                        <Link href={`/dashboard/applications/${p.application.id}`} className="hover:underline">
                          {p.application.fullName}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">{p.method.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3">Rs. {p.amount}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-navy-400 dark:text-navy-100">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    {can("documents.receipts") && (
                      <td className="px-4 py-3">
                        {(p.status === "PAID" || p.status === "MANUALLY_VERIFIED") && (
                          <button
                            disabled={generating === p.id}
                            onClick={() => downloadReceipt(p.id)}
                            className="text-xs text-navy underline hover:text-crimson disabled:opacity-50 dark:text-paper"
                          >
                            {generating === p.id ? "Generating…" : "Download"}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
