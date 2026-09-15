"use client";

import { useState } from "react";
import { apiFetch, downloadPdf, ApiError } from "../../../../lib/api-client";
import { Card } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Select } from "../../../../components/ui/select";
import type { ReportDataDto } from "@lifeline/types";

interface ReportDef {
  group: "Member Reports" | "Financial Reports" | "Administrative Reports";
  label: string;
  path: string; // relative to /reports, may include :param placeholders resolved below
  dateRange?: boolean;
}

const REPORTS: ReportDef[] = [
  { group: "Member Reports", label: "All Members", path: "members?view=all", dateRange: true },
  { group: "Member Reports", label: "Active Members", path: "members?view=active" },
  { group: "Member Reports", label: "Expired Members", path: "members?view=expired" },
  { group: "Member Reports", label: "Lifetime Members", path: "members?view=lifetime" },
  { group: "Member Reports", label: "Yearly Members", path: "members?view=yearly" },
  { group: "Member Reports", label: "District-wise", path: "members/by-district" },
  { group: "Member Reports", label: "Municipality-wise", path: "members/by-municipality" },
  { group: "Member Reports", label: "Ward-wise", path: "members/by-ward" },
  { group: "Member Reports", label: "By Membership Type", path: "members/by-type" },

  { group: "Financial Reports", label: "Income", path: "income", dateRange: true },
  { group: "Financial Reports", label: "Expenses", path: "expenses", dateRange: true },
  { group: "Financial Reports", label: "Income vs Expenses", path: "financial/income-vs-expenses", dateRange: true },
  { group: "Financial Reports", label: "Daily Collection", path: "financial/collection/daily", dateRange: true },
  { group: "Financial Reports", label: "Monthly Collection", path: "financial/collection/monthly", dateRange: true },
  { group: "Financial Reports", label: "Yearly Collection", path: "financial/collection/yearly", dateRange: true },
  { group: "Financial Reports", label: "Membership Revenue", path: "financial/membership-revenue", dateRange: true },
  { group: "Financial Reports", label: "Payment Method", path: "financial/payment-methods", dateRange: true },
  { group: "Financial Reports", label: "Outstanding Balance", path: "financial/outstanding-balance" },

  { group: "Administrative Reports", label: "User Activity", path: "administrative/user-activity", dateRange: true },
  { group: "Administrative Reports", label: "Membership Approvals", path: "administrative/applications/APPROVED" },
  { group: "Administrative Reports", label: "Pending Applications", path: "administrative/applications/UNDER_REVIEW" },
  { group: "Administrative Reports", label: "Rejected Applications", path: "administrative/applications/REJECTED" },
  { group: "Administrative Reports", label: "Generated Cards", path: "administrative/generated/cards" },
  { group: "Administrative Reports", label: "Generated Certificates", path: "administrative/generated/certificates" },
  { group: "Administrative Reports", label: "Generated Receipts", path: "administrative/generated/receipts" },
];

function withRange(path: string, from: string, to: string) {
  const sep = path.includes("?") ? "&" : "?";
  if (!from && !to) return path;
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return `${path}${sep}${params.toString()}`;
}

export default function ReportsPage() {
  const [selected, setSelected] = useState(REPORTS[0]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<ReportDataDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runReport() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const path = withRange(selected.path, from, to);
      const result = await apiFetch<ReportDataDto>(`/reports/${path}`);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to run this report.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadReport() {
    setDownloading(true);
    setError(null);
    try {
      const path = withRange(selected.path, from, to);
      const sep = path.includes("?") ? "&" : "?";
      await downloadPdf(`/reports/${path}${sep}format=pdf`, `${selected.label.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to generate this report's PDF.");
    } finally {
      setDownloading(false);
    }
  }

  const groups = Array.from(new Set(REPORTS.map((r) => r.group)));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl text-navy dark:text-paper">Reports</h1>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Report</label>
            <Select
              value={selected.path}
              onChange={(e) => setSelected(REPORTS.find((r) => r.path === e.target.value) ?? REPORTS[0])}
              className="w-64"
            >
              {groups.map((g) => (
                <optgroup key={g} label={g}>
                  {REPORTS.filter((r) => r.group === g).map((r) => (
                    <option key={r.path} value={r.path}>{r.label}</option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
          {selected.dateRange && (
            <>
              <div>
                <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">From</label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">To</label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </>
          )}
          <Button disabled={loading} onClick={runReport}>{loading ? "Running…" : "View"}</Button>
          <Button variant="secondary" disabled={downloading} onClick={downloadReport}>
            {downloading ? "Generating…" : "Download PDF"}
          </Button>
        </div>
      </Card>

      {error && <p className="text-crimson">{error}</p>}

      {data && (
        <Card className="overflow-x-auto p-0">
          <div className="flex items-center justify-between border-b border-navy-100 px-4 py-3 dark:border-navy-600">
            <p className="font-display text-lg text-navy dark:text-paper">{data.title}</p>
            {data.dateRangeLabel && <p className="text-sm text-navy-400 dark:text-navy-100">{data.dateRangeLabel}</p>}
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-navy-100 text-navy-400 dark:border-navy-600 dark:text-navy-100">
              <tr>
                {data.columns.map((c) => <th key={c.key} className="px-4 py-3 font-medium">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr><td colSpan={data.columns.length} className="px-4 py-8 text-center text-navy-400 dark:text-navy-100">No records match this report's filters.</td></tr>
              ) : (
                data.rows.map((row, i) => (
                  <tr key={i} className="border-b border-navy-100 last:border-0 dark:border-navy-600">
                    {data.columns.map((c) => <td key={c.key} className="px-4 py-3">{row[c.key] ?? ""}</td>)}
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {data.summaryLines && data.summaryLines.length > 0 && (
            <div className="border-t border-navy-100 px-4 py-3 text-sm font-medium text-navy dark:border-navy-600 dark:text-paper">
              {data.summaryLines.map((line, i) => <p key={i}>{line}</p>)}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
