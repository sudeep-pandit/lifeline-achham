"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../../../lib/api-client";
import { Card } from "../../../../components/ui/card";
import { Select } from "../../../../components/ui/select";
import { StatusBadge } from "../../../../components/ui/badge";
import type { ApplicationListItemDto } from "@lifeline/types";

export default function ApplicationsPage() {
  const [items, setItems] = useState<ApplicationListItemDto[] | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = status ? `?status=${status}` : "";
    apiFetch<ApplicationListItemDto[]>(`/applications${params}`)
      .then(setItems)
      .catch(() => setError("Unable to load applications. You may not have permission to view this page."));
  }, [status]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-navy dark:text-paper">Membership Applications</h1>
        <div className="w-56">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </Select>
        </div>
      </div>

      {error && <p className="text-crimson">{error}</p>}

      {items && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-navy-100 text-navy-400 dark:border-navy-600 dark:text-navy-100">
              <tr>
                <th className="px-4 py-3 font-medium">Application #</th>
                <th className="px-4 py-3 font-medium">Applicant</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">District</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-navy-400 dark:text-navy-100">
                    No pending applications.
                  </td>
                </tr>
              ) : (
                items.map((a) => (
                  <tr key={a.id} className="border-b border-navy-100 last:border-0 hover:bg-navy-50 dark:border-navy-600 dark:hover:bg-navy-600">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/applications/${a.id}`} className="font-medium text-navy underline-offset-2 hover:underline dark:text-paper">
                        {a.applicationNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{a.fullName}</td>
                    <td className="px-4 py-3">{a.membershipType.name}</td>
                    <td className="px-4 py-3">{a.district.name}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3 text-navy-400 dark:text-navy-100">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </td>
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
