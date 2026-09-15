"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../../lib/api-client";
import { Card } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import type { AuditLogDto } from "@lifeline/types";

interface AuditLogPage {
  items: AuditLogDto[];
  total: number;
  page: number;
  pageSize: number;
}

// Section 27: read-only for everyone, including Super Admin - there is no
// edit or delete action anywhere on this page by design.
export default function AuditLogsPage() {
  const [data, setData] = useState<AuditLogPage | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AuditLogPage>(`/audit-logs?page=${page}&pageSize=50`)
      .then(setData)
      .catch(() => setError("Unable to load audit logs. You may not have permission to view this page."));
  }, [page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl text-navy dark:text-paper">Audit Logs</h1>
      {error && <p className="text-crimson">{error}</p>}
      {data && (
        <>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-navy-100 text-navy-400 dark:border-navy-600 dark:text-navy-100">
                <tr>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Module</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-navy-400 dark:text-navy-100">No activity recorded yet.</td></tr>
                ) : (
                  data.items.map((log) => (
                    <tr key={log.id} className="border-b border-navy-100 last:border-0 dark:border-navy-600">
                      <td className="px-4 py-3 font-medium text-navy dark:text-paper">{log.userName ?? "System"}</td>
                      <td className="px-4 py-3">{log.action.replace(/\./g, " ")}</td>
                      <td className="px-4 py-3 text-navy-400 dark:text-navy-100">{log.module}</td>
                      <td className="px-4 py-3 text-navy-400 dark:text-navy-100">{new Date(log.createdAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
          <div className="flex items-center justify-between">
            <p className="text-sm text-navy-400 dark:text-navy-100">Page {data.page} of {totalPages} ({data.total} total)</p>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
