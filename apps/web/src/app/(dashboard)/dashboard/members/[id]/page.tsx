"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, downloadPdf, ApiError } from "../../../../../lib/api-client";
import { useAuth } from "../../../../../lib/auth-context";
import { ORGANIZATION_ID } from "../../../../../lib/org";
import { Card } from "../../../../../components/ui/card";
import { Button } from "../../../../../components/ui/button";
import { Input } from "../../../../../components/ui/input";
import { Select } from "../../../../../components/ui/select";
import { StatusBadge } from "../../../../../components/ui/badge";
import type {
  MemberDetailDto, DistrictDto, MunicipalityDto, MembershipTypeDto,
  PaymentListItemDto,
} from "@lifeline/types";

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();

  const [member, setMember] = useState<MemberDetailDto | null>(null);
  const [bills, setBills] = useState<PaymentListItemDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<MemberDetailDto>>({});
  const [photoPreview, setPhotoPreview] = useState<string | undefined | null>(undefined);
  const [districts, setDistricts] = useState<DistrictDto[]>([]);
  const [municipalities, setMunicipalities] = useState<MunicipalityDto[]>([]);
  const [membershipTypes, setMembershipTypes] = useState<MembershipTypeDto[]>([]);
  const [saving, setSaving] = useState(false);

  function load() {
    apiFetch<MemberDetailDto>(`/members/${id}`)
      .then((m) => { setMember(m); setForm(m); })
      .catch(() => setError("Unable to load this member."));
    apiFetch<PaymentListItemDto[]>(`/payments/member/${id}`).then(setBills).catch(() => {});
  }

  useEffect(load, [id]);

  useEffect(() => {
    if (!editing) return;
    apiFetch<DistrictDto[]>("/nepal-data/districts").then(setDistricts).catch(() => {});
    apiFetch<MembershipTypeDto[]>(`/membership-types/public?organizationId=${ORGANIZATION_ID}`)
      .then(setMembershipTypes)
      .catch(() => {});
  }, [editing]);

  useEffect(() => {
    if (!form.districtId) return;
    apiFetch<MunicipalityDto[]>(`/nepal-data/municipalities?districtId=${form.districtId}`).then(setMunicipalities).catch(() => {});
  }, [form.districtId]);

  function handlePhotoChange(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      setError("Photo must be a JPG or PNG image");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError("Photo must be under 3MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        fullName: form.fullName,
        dateOfBirth: form.dateOfBirth?.slice(0, 10),
        gender: form.gender,
        email: form.email,
        mobile: form.mobile,
        countryCode: form.countryCode,
        bloodGroup: form.bloodGroup,
        districtId: form.districtId,
        municipalityId: form.municipalityId,
        wardNo: form.wardNo ? Number(form.wardNo) : undefined,
        tole: form.tole,
        membershipTypeId: form.membershipTypeId,
        remarks: form.remarks,
      };
      if (photoPreview !== undefined) body.profilePhotoUrl = photoPreview ?? "";
      await apiFetch(`/members/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      setEditing(false);
      setPhotoPreview(undefined);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function download(kind: "membership-cards" | "certificates") {
    setGenerating(kind);
    setError(null);
    try {
      await downloadPdf(`/documents/${kind}/${id}/pdf`, `${member?.memberId}-${kind}.pdf`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to generate this document.");
    } finally {
      setGenerating(null);
    }
  }

  async function downloadReceipt(paymentId: string) {
    setGenerating(`receipt:${paymentId}`);
    try {
      await downloadPdf(`/documents/receipts/${paymentId}/pdf`, "receipt.pdf");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to generate this receipt.");
    } finally {
      setGenerating(null);
    }
  }

  if (error && !member) return <p className="text-crimson">{error}</p>;
  if (!member) return <p className="text-navy-400 dark:text-navy-100">Loading…</p>;

  const displayPhoto = photoPreview !== undefined ? photoPreview : member.profilePhotoUrl;

  return (
    <div className="flex flex-col gap-6">
      <button onClick={() => router.push("/dashboard/members")} className="w-fit text-sm text-navy-400 hover:text-crimson dark:text-navy-100">
        ← Back to Members
      </button>

      <Card>
        <div className="flex items-start gap-6">
          <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded border border-navy-100 bg-navy-50 dark:border-navy-600 dark:bg-navy-600">
            {displayPhoto ? (
              <img src={displayPhoto} alt={member.fullName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-navy-400 dark:text-navy-100">No photo</span>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-2xl text-navy dark:text-paper">{member.fullName}</p>
                <p className="text-sm text-navy-400 dark:text-navy-100">{member.memberId} · {member.membershipType.name}</p>
              </div>
              {can("members.edit") && !editing && (
                <Button onClick={() => setEditing(true)}>Edit</Button>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              <div><p className="text-navy-400 dark:text-navy-100">Blood Group</p><p className="text-navy dark:text-paper">{member.bloodGroup ?? "—"}</p></div>
              <div><p className="text-navy-400 dark:text-navy-100">Mobile</p><p className="text-navy dark:text-paper">{member.countryCode} {member.mobile}</p></div>
              <div><p className="text-navy-400 dark:text-navy-100">Email</p><p className="text-navy dark:text-paper">{member.email}</p></div>
              <div><p className="text-navy-400 dark:text-navy-100">Valid Until</p><p className="text-navy dark:text-paper">{member.expiresAt ? new Date(member.expiresAt).toLocaleDateString() : "Lifetime"}</p></div>
            </div>
            {member.application && (
              <Link href={`/dashboard/applications/${member.application.id}`} className="mt-2 inline-block text-xs text-navy underline hover:text-crimson dark:text-paper">
                View originating application ({member.application.applicationNumber})
              </Link>
            )}
          </div>
        </div>
      </Card>

      {editing ? (
        <Card>
          <p className="mb-3 font-display text-lg text-navy dark:text-paper">Edit member</p>
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded border border-navy-100 bg-navy-50 dark:border-navy-600 dark:bg-navy-600">
              {displayPhoto ? <img src={displayPhoto} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-navy-400 dark:text-navy-100">No photo</span>}
            </div>
            <label className="cursor-pointer rounded border border-navy-100 px-3 py-2 text-sm text-navy-400 hover:border-crimson hover:text-crimson dark:border-navy-400 dark:text-navy-100">
              Replace photo
              <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => handlePhotoChange(e.target.files?.[0])} />
            </label>
            {displayPhoto && <button onClick={() => setPhotoPreview(null)} className="text-xs text-crimson underline">Remove</button>}
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div><label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Full name</label><Input value={form.fullName ?? ""} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
            <div><label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Date of birth</label><Input type="date" value={form.dateOfBirth?.slice(0, 10) ?? ""} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} /></div>
            <div>
              <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Gender</label>
              <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as MemberDetailDto["gender"] })}>
                <option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
              </Select>
            </div>
            <div><label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Email</label><Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Mobile</label><Input value={form.mobile ?? ""} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
            <div><label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Blood group</label><Input value={form.bloodGroup ?? ""} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })} /></div>
            <div>
              <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">District</label>
              <Select value={form.districtId ?? ""} onChange={(e) => setForm({ ...form, districtId: e.target.value, municipalityId: "" })}>
                <option value="">Select…</option>
                {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Municipality</label>
              <Select value={form.municipalityId ?? ""} onChange={(e) => setForm({ ...form, municipalityId: e.target.value })}>
                <option value="">Select…</option>
                {municipalities.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </div>
            <div><label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Ward no.</label><Input type="number" value={form.wardNo ?? ""} onChange={(e) => setForm({ ...form, wardNo: Number(e.target.value) })} /></div>
            <div><label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Tole</label><Input value={form.tole ?? ""} onChange={(e) => setForm({ ...form, tole: e.target.value })} /></div>
            <div>
              <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Membership type</label>
              <Select value={form.membershipTypeId ?? ""} onChange={(e) => setForm({ ...form, membershipTypeId: e.target.value })}>
                {membershipTypes.length === 0 && <option value={member.membershipTypeId}>{member.membershipType.name}</option>}
                {membershipTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
            <div><label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Remarks</label><Input value={form.remarks ?? ""} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
          </div>
          {error && <p className="mt-3 text-sm text-crimson">{error}</p>}
          <div className="mt-4 flex gap-3">
            <Button disabled={saving} onClick={save}>{saving ? "Saving…" : "Save changes"}</Button>
            <Button variant="secondary" onClick={() => { setEditing(false); setForm(member); setPhotoPreview(undefined); }}>Cancel</Button>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="mb-3 font-display text-lg text-navy dark:text-paper">Address</p>
          <p className="text-sm text-navy dark:text-paper">{member.tole ? `${member.tole}, ` : ""}Ward {member.wardNo}, {member.municipality.name}, {member.district.name}</p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <p className="mb-3 font-display text-lg text-navy dark:text-paper">Documents</p>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-navy-400 dark:text-navy-100">Membership Card {member.cardNumber && `(${member.cardNumber})`}</span>
              {can("documents.cards") && (
                <button disabled={generating === "membership-cards"} onClick={() => download("membership-cards")} className="text-navy underline hover:text-crimson dark:text-paper">
                  {generating === "membership-cards" ? "Generating…" : "Download"}
                </button>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-navy-400 dark:text-navy-100">Certificate {member.certificateNumber && `(${member.certificateNumber})`}</span>
              {can("documents.certificates") && (
                <button disabled={generating === "certificates"} onClick={() => download("certificates")} className="text-navy underline hover:text-crimson dark:text-paper">
                  {generating === "certificates" ? "Generating…" : "Download"}
                </button>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <p className="mb-3 font-display text-lg text-navy dark:text-paper">Billing history</p>
          {bills.length === 0 ? (
            <p className="text-sm text-navy-400 dark:text-navy-100">No bills or payments on file yet.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {bills.map((b) => (
                <li key={b.id} className="flex items-center justify-between border-b border-navy-100 pb-2 last:border-0 dark:border-navy-600">
                  <span className="text-navy dark:text-paper">{b.paymentNumber}</span>
                  <span className="text-navy-400 dark:text-navy-100">Rs. {b.amount}</span>
                  <StatusBadge status={b.status} />
                  {(b.status === "PAID" || b.status === "MANUALLY_VERIFIED") && can("documents.receipts") && (
                    <button disabled={generating === `receipt:${b.id}`} onClick={() => downloadReceipt(b.id)} className="text-xs text-navy underline hover:text-crimson dark:text-paper">
                      Receipt
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
