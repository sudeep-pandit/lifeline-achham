"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, downloadPdf, ApiError } from "../../../../lib/api-client";
import { useAuth } from "../../../../lib/auth-context";
import { Card } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Select } from "../../../../components/ui/select";
import { StatusBadge } from "../../../../components/ui/badge";
import { ORGANIZATION_ID } from "../../../../lib/org";
import type {
  MemberListItemDto,
  DistrictDto,
  MunicipalityDto,
  MembershipTypeDto,
  CreateMemberRequest,
} from "@lifeline/types";

interface MembersResponse {
  items: MemberListItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

const BLANK_FORM: CreateMemberRequest = {
  fullName: "",
  dateOfBirth: "",
  gender: "MALE",
  districtId: "",
  municipalityId: "",
  wardNo: 1,
  tole: "",
  email: "",
  mobile: "",
  countryCode: "+977",
  bloodGroup: "",
  membershipTypeId: "",
  remarks: "",
};

export default function MembersPage() {
  const { can } = useAuth();
  const [data, setData] = useState<MembersResponse | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [districts, setDistricts] = useState<DistrictDto[]>([]);
  const [municipalities, setMunicipalities] = useState<MunicipalityDto[]>([]);
  const [membershipTypes, setMembershipTypes] = useState<MembershipTypeDto[]>([]);
  const [form, setForm] = useState<CreateMemberRequest>(BLANK_FORM);
  const [photoPreview, setPhotoPreview] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function handlePhotoChange(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      setFormError("Photo must be a JPG or PNG image");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setFormError("Photo must be under 3MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function download(kind: "membership-cards" | "certificates", member: MemberListItemDto) {
    const key = `${kind}:${member.id}`;
    setGenerating(key);
    setError(null);
    try {
      await downloadPdf(`/documents/${kind}/${member.id}/pdf`, `${member.memberId}-${kind}.pdf`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to generate this document.");
    } finally {
      setGenerating(null);
    }
  }

  function loadMembers() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    apiFetch<MembersResponse>(`/members?${params.toString()}`)
      .then(setData)
      .catch(() => setError("Unable to load members. You may not have permission to view this page."));
  }

  useEffect(() => {
    const timeout = setTimeout(loadMembers, 250); // light debounce on search typing
    return () => clearTimeout(timeout);
  }, [search, status]);

  useEffect(() => {
    if (!showForm) return;
    apiFetch<DistrictDto[]>("/nepal-data/districts").then(setDistricts).catch(() => {});
    apiFetch<MembershipTypeDto[]>(`/membership-types/public?organizationId=${ORGANIZATION_ID}`)
      .then(setMembershipTypes)
      .catch(() => {});
  }, [showForm]);

  useEffect(() => {
    if (!form.districtId) {
      setMunicipalities([]);
      return;
    }
    apiFetch<MunicipalityDto[]>(`/nepal-data/municipalities?districtId=${form.districtId}`)
      .then(setMunicipalities)
      .catch(() => {});
  }, [form.districtId]);

  async function submitNewMember() {
    if (!form.fullName || !form.dateOfBirth || !form.districtId || !form.municipalityId || !form.email || !form.mobile || !form.membershipTypeId) {
      setFormError("Please fill in name, date of birth, address, email, mobile, and membership type.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await apiFetch("/members", {
        method: "POST",
        body: JSON.stringify({ ...form, wardNo: Number(form.wardNo), profilePhotoUrl: photoPreview }),
      });
      setForm(BLANK_FORM);
      setPhotoPreview(undefined);
      setShowForm(false);
      loadMembers();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Unable to add this member.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-navy dark:text-paper">Members</h1>
        {can("members.create") && (
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "+ Add Member"}</Button>
        )}
      </div>

      {showForm && (
        <Card>
          <p className="mb-3 font-display text-lg text-navy dark:text-paper">Register a member directly</p>
          <p className="mb-4 text-sm text-navy-400 dark:text-navy-100">
            For walk-ins or offline registrations — this skips the online application/payment flow. If
            they paid, record that separately on the Finance page.
          </p>
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded border border-navy-100 bg-navy-50 dark:border-navy-600 dark:bg-navy-600">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-navy-400 dark:text-navy-100">No photo</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className="cursor-pointer rounded border border-navy-100 px-3 py-2 text-center text-sm text-navy-400 hover:border-crimson hover:text-crimson dark:border-navy-400 dark:text-navy-100">
                {photoPreview ? "Replace photo" : "Upload passport photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => handlePhotoChange(e.target.files?.[0])}
                />
              </label>
              {photoPreview && (
                <button onClick={() => setPhotoPreview(undefined)} className="text-xs text-crimson underline">
                  Remove photo
                </button>
              )}
              <p className="text-xs text-navy-400 dark:text-navy-100">JPG or PNG, under 3MB</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Full name</label>
              <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Date of birth</label>
              <Input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Gender</label>
              <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as CreateMemberRequest["gender"] })}>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">District</label>
              <Select value={form.districtId} onChange={(e) => setForm({ ...form, districtId: e.target.value, municipalityId: "" })}>
                <option value="">Select…</option>
                {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Municipality</label>
              <Select value={form.municipalityId} onChange={(e) => setForm({ ...form, municipalityId: e.target.value })} disabled={!form.districtId}>
                <option value="">Select…</option>
                {municipalities.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Ward no.</label>
              <Input type="number" min={1} value={form.wardNo} onChange={(e) => setForm({ ...form, wardNo: Number(e.target.value) })} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Tole (optional)</label>
              <Input value={form.tole} onChange={(e) => setForm({ ...form, tole: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Email</label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Mobile</label>
              <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Blood group (optional)</label>
              <Input placeholder="A+, O-, etc." value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Membership type</label>
              <Select value={form.membershipTypeId} onChange={(e) => setForm({ ...form, membershipTypeId: e.target.value })}>
                <option value="">Select…</option>
                {membershipTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Remarks (optional)</label>
              <Input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </div>
          </div>
          {formError && <p className="mt-3 text-sm text-crimson">{formError}</p>}
          <Button className="mt-4" disabled={submitting} onClick={submitNewMember}>
            {submitting ? "Adding…" : "Add member"}
          </Button>
        </Card>
      )}

      <Card className="flex flex-wrap gap-4">
        <div className="min-w-[240px] flex-1">
          <Input
            placeholder="Search by name, member ID, phone, or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-48">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRING_SOON">Expiring soon</option>
            <option value="EXPIRED">Expired</option>
          </Select>
        </div>
      </Card>

      {error && <p className="text-crimson">{error}</p>}

      {data && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-navy-100 text-navy-400 dark:border-navy-600 dark:text-navy-100">
              <tr>
                <th className="px-4 py-3 font-medium">Member ID</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">District</th>
                <th className="px-4 py-3 font-medium">Blood Group</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                {(can("documents.cards") || can("documents.certificates")) && (
                  <th className="px-4 py-3 font-medium">Documents</th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-navy-400 dark:text-navy-100">
                    No members found.
                  </td>
                </tr>
              ) : (
                data.items.map((m) => (
                  <tr key={m.id} className="border-b border-navy-100 last:border-0 dark:border-navy-600">
                    <td className="px-4 py-3 font-medium text-navy dark:text-paper">
                      <Link href={`/dashboard/members/${m.id}`} className="hover:underline">{m.memberId}</Link>
                    </td>
                    <td className="px-4 py-3">{m.fullName}</td>
                    <td className="px-4 py-3">{m.membershipType.name}</td>
                    <td className="px-4 py-3">{m.district.name}</td>
                    <td className="px-4 py-3 text-navy-400 dark:text-navy-100">{m.bloodGroup ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                    <td className="px-4 py-3 text-navy-400 dark:text-navy-100">
                      {m.expiresAt ? new Date(m.expiresAt).toLocaleDateString() : "Lifetime"}
                    </td>
                    {(can("documents.cards") || can("documents.certificates")) && (
                      <td className="px-4 py-3">
                        <div className="flex gap-3 text-xs">
                          {can("documents.cards") && (
                            <button
                              disabled={generating === `membership-cards:${m.id}`}
                              onClick={() => download("membership-cards", m)}
                              className="text-navy underline hover:text-crimson disabled:opacity-50 dark:text-paper"
                            >
                              {generating === `membership-cards:${m.id}` ? "Generating…" : "Card"}
                            </button>
                          )}
                          {can("documents.certificates") && (
                            <button
                              disabled={generating === `certificates:${m.id}`}
                              onClick={() => download("certificates", m)}
                              className="text-navy underline hover:text-crimson disabled:opacity-50 dark:text-paper"
                            >
                              {generating === `certificates:${m.id}` ? "Generating…" : "Certificate"}
                            </button>
                          )}
                        </div>
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
