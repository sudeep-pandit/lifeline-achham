"use client";

import { useEffect, useState } from "react";
import { apiFetch, downloadPdf, ApiError } from "../../../../lib/api-client";
import { Card } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { StatusBadge } from "../../../../components/ui/badge";
import type { BackupDto } from "@lifeline/types";

function formatSize(bytes?: number | null) {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

// Section 30, Super Admin only. Restore is deliberately not a single
// click: it requires typing RESTORE, since it overwrites the live
// database with the backup's contents.
export default function BackupsPage() {
  const [backups, setBackups] = useState<BackupDto[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);

  function load() {
    apiFetch<BackupDto[]>("/backups").then(setBackups).catch(() => setError("Unable to load backups. This page is Super Admin only."));
  }

  useEffect(load, []);

  async function createBackup() {
    setCreating(true);
    setError(null);
    try {
      await apiFetch("/backups", { method: "POST", body: JSON.stringify({}) });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to start a backup.");
    } finally {
      setCreating(false);
    }
  }

  async function download(id: string) {
    try {
      await downloadPdf(`/backups/${id}/download`, `backup-${id}.sql.gz`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to download this backup.");
    }
  }

  async function confirmRestore() {
    if (!restoreTarget || confirmText !== "RESTORE") return;
    setRestoring(true);
    setError(null);
    try {
      await apiFetch(`/backups/${restoreTarget}/restore`, { method: "POST", body: JSON.stringify({ confirm: "RESTORE" }) });
      setRestoreTarget(null);
      setConfirmText("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Restore failed.");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-navy dark:text-paper">Backup &amp; Restore</h1>
        <Button disabled={creating} onClick={createBackup}>{creating ? "Starting…" : "Create backup now"}</Button>
      </div>

      <p className="text-sm text-navy-400 dark:text-navy-100">
        Requires the PostgreSQL client tools (<code>pg_dump</code>/<code>psql</code>) installed on the
        server running this API. Automatic backups can be enabled via <code>BACKUP_AUTOMATIC_ENABLED</code>
        in the API's environment.
      </p>

      {error && <p className="text-crimson">{error}</p>}

      {backups && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-navy-100 text-navy-400 dark:border-navy-600 dark:text-navy-100">
              <tr>
                <th className="px-4 py-3 font-medium">Started</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Size</th>
                <th className="px-4 py-3 font-medium">By</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-navy-400 dark:text-navy-100">No backups yet.</td></tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.id} className="border-b border-navy-100 last:border-0 dark:border-navy-600">
                    <td className="px-4 py-3">{new Date(b.startedAt).toLocaleString()}</td>
                    <td className="px-4 py-3">{b.type}</td>
                    <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-3">{formatSize(b.fileSizeBytes)}</td>
                    <td className="px-4 py-3 text-navy-400 dark:text-navy-100">{b.createdBy?.fullName ?? "System"}</td>
                    <td className="px-4 py-3">
                      {b.status === "COMPLETED" && (
                        <div className="flex gap-3 text-xs">
                          <button onClick={() => download(b.id)} className="text-navy underline hover:text-crimson dark:text-paper">Download</button>
                          <button onClick={() => setRestoreTarget(b.id)} className="text-crimson underline hover:text-crimson-600">Restore</button>
                        </div>
                      )}
                      {b.status === "FAILED" && b.errorMessage && (
                        <span className="text-xs text-crimson">{b.errorMessage}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}

      {restoreTarget && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-sm">
            <p className="mb-2 font-display text-lg text-crimson">Restore database?</p>
            <p className="mb-4 text-sm text-navy-400 dark:text-navy-100">
              This overwrites all current data with this backup's contents. This cannot be undone. Type
              <span className="mx-1 font-mono font-semibold">RESTORE</span> to confirm.
            </p>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="RESTORE" className="mb-4" />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => { setRestoreTarget(null); setConfirmText(""); }}>Cancel</Button>
              <Button variant="danger" disabled={confirmText !== "RESTORE" || restoring} onClick={confirmRestore}>
                {restoring ? "Restoring…" : "Restore now"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
