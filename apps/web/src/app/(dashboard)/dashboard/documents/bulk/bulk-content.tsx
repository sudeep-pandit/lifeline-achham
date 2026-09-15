"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch, downloadPdf, ApiError } from "../../../../../lib/api-client";
import { Card } from "../../../../../components/ui/card";
import { Button } from "../../../../../components/ui/button";
import { Select } from "../../../../../components/ui/select";
import type { MemberListItemDto, DocumentTemplateDto, DocumentTemplateKind } from "@lifeline/types";

// Section: "A4 Bulk ID Card Generation" (5x2, 10 per sheet, duplex-ready)
// and "Bulk Certificates" (combined PDF). Both share this one page since
// the flow is identical: pick members, pick a template, generate.
export function BulkGenerateContent() {
  const params = useSearchParams();
  const type = (params.get("type") === "CERTIFICATE" ? "CERTIFICATE" : "CARD") as DocumentTemplateKind;

  const [members, setMembers] = useState<MemberListItemDto[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplateDto[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ items: MemberListItemDto[] }>(`/members?pageSize=200&search=${encodeURIComponent(search)}`)
      .then((d) => setMembers(d.items))
      .catch(() => setError("Unable to load members."));
  }, [search]);

  useEffect(() => {
    apiFetch<DocumentTemplateDto[]>(`/document-templates?type=${type}`).then(setTemplates).catch(() => {});
  }, [type]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((s) => (s.size === members.length ? new Set() : new Set(members.map((m) => m.id))));
  }

  async function generate() {
    if (selected.size === 0) {
      setError("Select at least one member.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const path = type === "CARD" ? "documents/membership-cards/bulk/pdf" : "documents/certificates/bulk/pdf";
      await downloadPdf(
        `/${path}`,
        `${type.toLowerCase()}s-bulk.pdf`,
        {
          method: "POST",
          body: JSON.stringify({ memberIds: Array.from(selected), templateId: templateId || undefined }),
        },
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to generate bulk PDF.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl text-navy dark:text-paper">
        Bulk {type === "CARD" ? "ID Card" : "Certificate"} Generation
      </h1>
      {type === "CARD" && (
        <p className="text-sm text-navy-400 dark:text-navy-100">
          Generates one combined PDF: front sides laid out 5 across × 2 rows (10 per A4 landscape sheet),
          followed by matching back-side sheets (mirrored for duplex printing).
        </p>
      )}

      <Card className="flex flex-wrap items-center gap-3">
        <input placeholder="Search members…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56 rounded border border-navy-100 bg-white px-3 py-2 text-sm dark:border-navy-400 dark:bg-navy-900 dark:text-paper" />
        <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-64">
          <option value="">Use default template</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <Button variant="secondary" onClick={toggleAll}>{selected.size === members.length ? "Deselect all" : "Select all"}</Button>
        <span className="text-sm text-navy-400 dark:text-navy-100">{selected.size} selected</span>
        <Button className="ml-auto" disabled={generating} onClick={generate}>
          {generating ? "Generating…" : `Generate ${selected.size || ""} PDF`}
        </Button>
      </Card>

      {error && <p className="text-crimson">{error}</p>}

      <Card className="max-h-[60vh] overflow-y-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 border-b border-navy-100 bg-white text-navy-400 dark:border-navy-600 dark:bg-navy-900 dark:text-navy-100">
            <tr>
              <th className="px-4 py-3"></th>
              <th className="px-4 py-3 font-medium">Member ID</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Type</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-navy-100 last:border-0 dark:border-navy-600">
                <td className="px-4 py-3"><input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} /></td>
                <td className="px-4 py-3 font-medium text-navy dark:text-paper">{m.memberId}</td>
                <td className="px-4 py-3">{m.fullName}</td>
                <td className="px-4 py-3">{m.membershipType.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
