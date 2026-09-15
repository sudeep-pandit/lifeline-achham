"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../lib/api-client";
import { ORGANIZATION_ID } from "../../lib/org";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Card } from "../../components/ui/card";
import type { DistrictDto, MunicipalityDto, MembershipTypeDto, AvailableOnlineMethodDto } from "@lifeline/types";

// Public membership application form (Section 8). Reachable without login.
// The server - not this form - computes the application number and snapshots
// the membership fee, so nothing pricing-related here is trusted input.
export default function ApplyPage() {
  const [districts, setDistricts] = useState<DistrictDto[]>([]);
  const [municipalities, setMunicipalities] = useState<MunicipalityDto[]>([]);
  const [wards, setWards] = useState<number[]>([]);
  const [membershipTypes, setMembershipTypes] = useState<MembershipTypeDto[]>([]);

  const [form, setForm] = useState({
    fullName: "", dateOfBirth: "", gender: "MALE",
    districtId: "", municipalityId: "", wardNo: "", tole: "",
    email: "", mobile: "", countryCode: "+977", membershipTypeId: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; applicationNumber: string } | null>(null);

  const [onlineMethods, setOnlineMethods] = useState<AvailableOnlineMethodDto[]>([]);
  const [payingWith, setPayingWith] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<DistrictDto[]>("/nepal-data/districts").then(setDistricts).catch(() => {});
    apiFetch<MembershipTypeDto[]>(`/membership-types/public?organizationId=${ORGANIZATION_ID}`)
      .then(setMembershipTypes)
      .catch(() => {});
    apiFetch<AvailableOnlineMethodDto[]>("/payments/public/methods").then(setOnlineMethods).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.districtId) {
      setMunicipalities([]);
      return;
    }
    apiFetch<MunicipalityDto[]>(`/nepal-data/municipalities?districtId=${form.districtId}`)
      .then(setMunicipalities)
      .catch(() => {});
    setForm((f) => ({ ...f, municipalityId: "", wardNo: "" }));
  }, [form.districtId]);

  useEffect(() => {
    if (!form.municipalityId) {
      setWards([]);
      return;
    }
    apiFetch<number[]>(`/nepal-data/wards?municipalityId=${form.municipalityId}`)
      .then(setWards)
      .catch(() => {});
    setForm((f) => ({ ...f, wardNo: "" }));
  }, [form.municipalityId]);

  const selectedType = membershipTypes.find((t) => t.id === form.membershipTypeId);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await apiFetch<{ id: string; applicationNumber: string }>(
        `/applications/public?organizationId=${ORGANIZATION_ID}`,
        {
          method: "POST",
          body: JSON.stringify({
            ...form,
            wardNo: Number(form.wardNo),
          }),
        },
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to submit your application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function payOnline(method: string) {
    if (!result) return;
    setPayingWith(method);
    setPayError(null);
    try {
      const data = await apiFetch<{ checkout: { action?: string; fields?: Record<string, string> } }>(
        "/payments/public/initiate",
        { method: "POST", body: JSON.stringify({ applicationId: result.id, method }) },
      );
      if (data.checkout.action && data.checkout.fields) {
        // eSewa-style: build and auto-submit a form to the gateway.
        const checkoutForm = document.createElement("form");
        checkoutForm.method = "POST";
        checkoutForm.action = data.checkout.action;
        for (const [key, value] of Object.entries(data.checkout.fields)) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = key;
          input.value = value;
          checkoutForm.appendChild(input);
        }
        document.body.appendChild(checkoutForm);
        checkoutForm.submit();
      }
    } catch (err) {
      setPayError(err instanceof ApiError ? err.message : "Unable to start this payment method right now.");
    } finally {
      setPayingWith(null);
    }
  }

  if (result) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-10 dark:bg-navy-900">
        <Card className="w-full max-w-md">
          <div className="text-center">
            <p className="font-display text-2xl text-navy dark:text-paper">Application submitted</p>
            <p className="mt-2 text-sm text-navy-400 dark:text-navy-100">Your application number is</p>
            <p className="mt-1 font-display text-xl text-crimson">{result.applicationNumber}</p>
            <p className="mt-2 text-sm text-navy-400 dark:text-navy-100">Keep this number for reference.</p>
          </div>

          <div className="mt-6 border-t border-navy-100 pt-6 dark:border-navy-600">
            <p className="mb-3 font-display text-lg text-navy dark:text-paper">Complete your payment</p>
            <p className="mb-4 text-sm text-navy-400 dark:text-navy-100">
              Pay online now, or pay in person / by bank deposit — mention your application number and
              our staff will record it against your application.
            </p>

            <div className="flex flex-col gap-2">
              {onlineMethods.map((m) => (
                <Button
                  key={m.method}
                  variant="secondary"
                  disabled={!m.configured || payingWith !== null}
                  onClick={() => payOnline(m.method)}
                  title={!m.configured ? "Not available yet for this organization" : undefined}
                >
                  {payingWith === m.method ? "Redirecting…" : `Pay with ${m.method}`}
                  {!m.configured && " (not yet available)"}
                </Button>
              ))}
            </div>

            {payError && <p className="mt-3 text-sm text-crimson">{payError}</p>}
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-10 dark:bg-navy-900">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <p className="font-display text-2xl text-navy dark:text-paper">Lifeline Achham</p>
          <p className="mt-1 text-navy-400 dark:text-navy-100">Membership Application</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <section className="flex flex-col gap-4">
              <h2 className="font-display text-lg text-navy dark:text-paper">Personal details</h2>
              <Field label="Full name">
                <Input required value={form.fullName} onChange={(e) => update("fullName", e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Date of birth">
                  <Input type="date" required value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} />
                </Field>
                <Field label="Gender">
                  <Select value={form.gender} onChange={(e) => update("gender", e.target.value)}>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </Select>
                </Field>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="font-display text-lg text-navy dark:text-paper">Permanent address</h2>
              <div className="grid grid-cols-2 gap-4">
                <Field label="District">
                  <Select required value={form.districtId} onChange={(e) => update("districtId", e.target.value)}>
                    <option value="">Select district</option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Municipality / Rural Municipality">
                  <Select
                    required
                    disabled={!form.districtId}
                    value={form.municipalityId}
                    onChange={(e) => update("municipalityId", e.target.value)}
                  >
                    <option value="">
                      {municipalities.length === 0 && form.districtId ? "Not available yet — contact us" : "Select municipality"}
                    </option>
                    {municipalities.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Ward No.">
                  <Select required disabled={!form.municipalityId} value={form.wardNo} onChange={(e) => update("wardNo", e.target.value)}>
                    <option value="">Select ward</option>
                    {wards.map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Tole (optional)">
                  <Input value={form.tole} onChange={(e) => update("tole", e.target.value)} />
                </Field>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="font-display text-lg text-navy dark:text-paper">Contact</h2>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email">
                  <Input type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} />
                </Field>
                <Field label="Mobile number">
                  <div className="flex gap-2">
                    <Input className="w-20" value={form.countryCode} onChange={(e) => update("countryCode", e.target.value)} />
                    <Input required value={form.mobile} onChange={(e) => update("mobile", e.target.value)} />
                  </div>
                </Field>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="font-display text-lg text-navy dark:text-paper">Membership</h2>
              <Field label="Membership type">
                <Select required value={form.membershipTypeId} onChange={(e) => update("membershipTypeId", e.target.value)}>
                  <option value="">Select membership type</option>
                  {membershipTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </Select>
              </Field>
              {selectedType && (
                <p className="text-sm text-navy-400 dark:text-navy-100">
                  Fee: Rs. {selectedType.price} &middot;{" "}
                  {selectedType.durationDays ? `${selectedType.durationDays} days` : "Lifetime, no expiry"}
                </p>
              )}
            </section>

            {error && (
              <p role="alert" className="rounded bg-crimson-50 px-3 py-2 text-sm text-crimson-600">
                {error}
              </p>
            )}

            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit application"}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-navy-400 dark:text-navy-100">{label}</span>
      {children}
    </label>
  );
}
