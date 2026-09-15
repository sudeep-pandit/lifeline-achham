"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api-client";
import { Card, CardLabel, CardValue } from "../../../components/ui/card";
import type { DashboardSummaryDto } from "@lifeline/types";

const CARD_DEFS: { key: keyof DashboardSummaryDto; label: string }[] = [
  { key: "totalMembers", label: "Total Members" },
  { key: "activeMembers", label: "Active Members" },
  { key: "lifetimeMembers", label: "Lifetime Members" },
  { key: "yearlyMembers", label: "Yearly Members" },
  { key: "pendingApplications", label: "Pending Applications" },
  { key: "expiringMemberships", label: "Expiring Memberships" },
  { key: "todaysIncome", label: "Today's Income" },
  { key: "monthlyIncome", label: "Monthly Income" },
  { key: "monthlyExpenses", label: "Monthly Expenses" },
  { key: "currentBalance", label: "Current Balance" },
];

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummaryDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<DashboardSummaryDto>("/dashboard/summary")
      .then(setSummary)
      .catch(() => setError("Unable to load dashboard data."));
  }, []);

  if (error) return <p className="text-crimson">{error}</p>;
  if (!summary) return <p className="text-navy-400">Loading dashboard…</p>;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl text-navy dark:text-paper">
          Good day, {summary.greetingName}
        </h1>
        <p className="mt-1 text-sm text-navy-400 dark:text-navy-100">
          {summary.dayOfWeek}, {summary.dateAD} &middot; BS {summary.dateBS}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {CARD_DEFS.map((def) => (
          <Card key={def.key}>
            <CardLabel>{def.label}</CardLabel>
            <CardValue>{summary[def.key] as number}</CardValue>
          </Card>
        ))}
      </div>

      <Card>
        <p className="mb-3 font-display text-lg text-navy dark:text-paper">Recent activity</p>
        {summary.recentActivities.length === 0 ? (
          <p className="text-sm text-navy-400 dark:text-navy-100">
            No activity yet. Actions across the system will appear here as they happen.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {summary.recentActivities.map((a) => (
              <li key={a.id} className="text-sm text-navy-400 dark:text-navy-100">
                <span className="font-medium text-navy dark:text-paper">{a.userName}</span> {a.action.replace(/\./g, " ")}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
