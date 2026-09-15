"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../../lib/api-client";
import { Card } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import type { OrganizationSettingsDto } from "@lifeline/types";

// Section 3: every field here is what the rest of the app reads from -
// nothing about the organization is hard-coded elsewhere.
const FIELDS: { key: keyof OrganizationSettingsDto; label: string }[] = [
  { key: "registrationNumber", label: "Registration Number" },
  { key: "panVatNumber", label: "PAN / VAT Number" },
  { key: "address", label: "Address" },
  { key: "district", label: "District" },
  { key: "municipality", label: "Municipality" },
  { key: "ward", label: "Ward" },
  { key: "phone", label: "Phone" },
  { key: "mobile", label: "Mobile" },
  { key: "email", label: "Email" },
  { key: "website", label: "Website" },
  { key: "facebookUrl", label: "Facebook URL" },
  { key: "instagramUrl", label: "Instagram URL" },
];

const PREFIX_FIELDS: { key: keyof OrganizationSettingsDto; label: string }[] = [
  { key: "membershipIdPrefix", label: "Membership ID Prefix" },
  { key: "receiptPrefix", label: "Receipt Prefix" },
  { key: "certificatePrefix", label: "Certificate Prefix" },
  { key: "cardPrefix", label: "Card Prefix" },
  { key: "temporaryRegPrefix", label: "Temp. Registration Prefix" },
  { key: "expensePrefix", label: "Expense Prefix" },
  { key: "incomePrefix", label: "Income Prefix" },
  { key: "paymentPrefix", label: "Payment Prefix" },
  { key: "applicationPrefix", label: "Application Prefix" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<OrganizationSettingsDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<OrganizationSettingsDto>("/organizations/settings")
      .then(setSettings)
      .catch(() => setError("Unable to load settings. You may not have permission to view this page."));
  }, []);

  function update(key: keyof OrganizationSettingsDto, value: string) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSuccess(false);
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const { id, name, ...editable } = settings;
      await apiFetch("/organizations/settings", { method: "PATCH", body: JSON.stringify(editable) });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (error && !settings) return <p className="text-crimson">{error}</p>;
  if (!settings) return <p className="text-navy-400 dark:text-navy-100">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl text-navy dark:text-paper">Organization Settings</h1>

      <Card>
        <p className="mb-4 font-display text-lg text-navy dark:text-paper">Organization Details</p>
        <div className="grid grid-cols-2 gap-4">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">{f.label}</label>
              <Input value={(settings[f.key] as string) ?? ""} onChange={(e) => update(f.key, e.target.value)} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <p className="mb-4 font-display text-lg text-navy dark:text-paper">Numbering Prefixes</p>
        <p className="mb-4 text-sm text-navy-400 dark:text-navy-100">
          Changing a prefix only affects numbers issued after the change - existing records keep their
          original numbers.
        </p>
        <div className="grid grid-cols-3 gap-4">
          {PREFIX_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">{f.label}</label>
              <Input value={(settings[f.key] as string) ?? ""} onChange={(e) => update(f.key, e.target.value)} />
            </div>
          ))}
        </div>
      </Card>

      {error && <p className="text-crimson">{error}</p>}
      {success && <p className="text-sage">Settings saved.</p>}
      <div>
        <Button disabled={saving} onClick={save}>{saving ? "Saving…" : "Save settings"}</Button>
      </div>
    </div>
  );
}
