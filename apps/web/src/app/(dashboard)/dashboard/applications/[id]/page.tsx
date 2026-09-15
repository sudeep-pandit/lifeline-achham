"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, downloadPdf, ApiError } from "../../../../../lib/api-client";
import { useAuth } from "../../../../../lib/auth-context";
import { Card } from "../../../../../components/ui/card";
import { Button } from "../../../../../components/ui/button";
import { Select } from "../../../../../components/ui/select";
import { Input } from "../../../../../components/ui/input";
import { StatusBadge } from "../../../../../components/ui/badge";
import type { ApplicationDetailDto, ReviewApplicationRequest, RecordOfflinePaymentRequest } from "@lifeline/types";

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();

  const [application, setApplication] = useState<ApplicationDetailDto | null>(null);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [offlineMethod, setOfflineMethod] = useState<RecordOfflinePaymentRequest["method"]>("CASH");
  const [offlineReference, setOfflineReference] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);

  async function downloadTempRegistration() {
    if (!application) return;
    setGenerating("temp-reg");
    setError(null);
    try {
      await downloadPdf(`/documents/temporary-registrations/${application.id}/pdf`, `${application.applicationNumber}-temporary-registration.pdf`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to generate this document.");
    } finally {
      setGenerating(null);
    }
  }

  async function downloadReceipt(paymentId: string) {
    setGenerating(`receipt:${paymentId}`);
    setError(null);
    try {
      await downloadPdf(`/documents/receipts/${paymentId}/pdf`, "receipt.pdf");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to generate this document.");
    } finally {
      setGenerating(null);
    }
  }

  function load() {
    apiFetch<ApplicationDetailDto>(`/applications/${id}`)
      .then(setApplication)
      .catch(() => setError("Unable to load this application."));
  }

  useEffect(load, [id]);

  async function act(action: ReviewApplicationRequest["action"]) {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/applications/${id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ action, remarks: remarks || undefined }),
      });
      load();
      setRemarks("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to complete this action.");
    } finally {
      setSubmitting(false);
    }
  }

  async function recordPayment() {
    if (!application) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/payments", {
        method: "POST",
        body: JSON.stringify({
          applicationId: application.id,
          method: offlineMethod,
          offlineReference: offlineReference || undefined,
        }),
      });
      load();
      setOfflineReference("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to record this payment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyPayment(paymentId: string) {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/payments/${paymentId}/verify`, { method: "PATCH", body: JSON.stringify({}) });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to verify this payment.");
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !application) return <p className="text-crimson">{error}</p>;
  if (!application) return <p className="text-navy-400">Loading…</p>;

  const isPending = !["APPROVED", "REJECTED", "CANCELLED"].includes(application.status);
  const hasVerifiedPayment = application.payments.some((p) => p.status === "PAID" || p.status === "MANUALLY_VERIFIED");

  return (
    <div className="flex flex-col gap-6">
      <button onClick={() => router.back()} className="w-fit text-sm text-navy-400 hover:text-crimson dark:text-navy-100">
        &larr; Back to applications
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-navy dark:text-paper">{application.applicationNumber}</h1>
          <p className="text-sm text-navy-400 dark:text-navy-100">{application.fullName}</p>
        </div>
        <StatusBadge status={application.status} />
      </div>

      {application.member && (
        <Card className="border-sage/40 bg-sage-50">
          <p className="text-sm text-sage">
            Approved — Member ID <span className="font-medium">{application.member.memberId}</span>
          </p>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <p className="mb-3 font-display text-lg text-navy dark:text-paper">Personal &amp; contact</p>
          <dl className="flex flex-col gap-2 text-sm">
            <Row label="Date of birth" value={new Date(application.dateOfBirth).toLocaleDateString()} />
            <Row label="Gender" value={application.gender} />
            <Row label="Email" value={application.email} />
            <Row label="Mobile" value={`${application.countryCode} ${application.mobile}`} />
            <Row label="Address" value={`${application.municipality.name}, Ward ${application.wardNo}, ${application.district.name}${application.tole ? `, ${application.tole}` : ""}`} />
          </dl>
        </Card>

        <Card>
          <p className="mb-3 font-display text-lg text-navy dark:text-paper">Membership</p>
          <dl className="flex flex-col gap-2 text-sm">
            <Row label="Type" value={application.membershipType.name} />
            <Row label="Fee" value={`Rs. ${application.membershipFee}`} />
            <Row label="Duration" value={application.membershipType.durationDays ? `${application.membershipType.durationDays} days` : "Lifetime"} />
            <Row label="Submitted" value={new Date(application.createdAt).toLocaleString()} />
            {application.reviewedBy && <Row label="Reviewed by" value={application.reviewedBy.fullName} />}
          </dl>
        </Card>
      </div>

      <Card>
        <p className="mb-3 font-display text-lg text-navy dark:text-paper">Payments</p>
        {application.payments.length === 0 ? (
          <p className="text-sm text-navy-400 dark:text-navy-100">No payment recorded yet.</p>
        ) : (
          <ul className="mb-4 flex flex-col gap-2 text-sm">
            {application.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 border-b border-navy-100 pb-2 last:border-0 dark:border-navy-600">
                <span className="text-navy dark:text-paper">{p.paymentNumber}</span>
                <span className="text-navy-400 dark:text-navy-100">{p.method.replace(/_/g, " ")}</span>
                <span className="text-navy-400 dark:text-navy-100">Rs. {p.amount}</span>
                <StatusBadge status={p.status} />
                {(p.status === "PAID" || p.status === "MANUALLY_VERIFIED") && can("documents.receipts") && (
                  <button
                    disabled={generating === `receipt:${p.id}`}
                    onClick={() => downloadReceipt(p.id)}
                    className="text-xs text-navy underline hover:text-crimson disabled:opacity-50 dark:text-paper"
                  >
                    {generating === `receipt:${p.id}` ? "Generating…" : "Receipt"}
                  </button>
                )}
                {p.status === "PENDING" && !["ESEWA", "KHALTI", "CONNECTIPS"].includes(p.method) && can("payments.verify") && (
                  <Button disabled={submitting} onClick={() => verifyPayment(p.id)} variant="secondary">
                    Verify
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {hasVerifiedPayment ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-sage">A verified payment is on file — this application can be approved.</p>
            {can("documents.temporary_registration") && (
              <Button variant="secondary" disabled={generating === "temp-reg"} onClick={downloadTempRegistration}>
                {generating === "temp-reg" ? "Generating…" : "Download temporary registration"}
              </Button>
            )}
          </div>
        ) : (
          can("payments.create") && (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Record offline payment</label>
                <Select value={offlineMethod} onChange={(e) => setOfflineMethod(e.target.value as RecordOfflinePaymentRequest["method"])}>
                  <option value="CASH">Cash</option>
                  <option value="BANK_DEPOSIT">Bank Deposit</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="OTHER">Other</option>
                </Select>
              </div>
              <Input
                placeholder="Reference no. (optional)"
                value={offlineReference}
                onChange={(e) => setOfflineReference(e.target.value)}
                className="w-48"
              />
              <Button disabled={submitting} onClick={recordPayment}>Record payment</Button>
            </div>
          )
        )}
      </Card>

      <Card>
        <p className="mb-3 font-display text-lg text-navy dark:text-paper">Status history</p>
        <ul className="flex flex-col gap-2 text-sm">
          {application.statusHistory.map((h) => (
            <li key={h.id} className="flex items-center gap-2 text-navy-400 dark:text-navy-100">
              <StatusBadge status={h.toStatus} />
              <span>{new Date(h.createdAt).toLocaleString()}</span>
              {h.changedBy && <span>&middot; {h.changedBy.fullName}</span>}
              {h.remarks && <span>&middot; {h.remarks}</span>}
            </li>
          ))}
        </ul>
      </Card>

      {isPending && can("applications.review") && (
        <Card>
          <p className="mb-3 font-display text-lg text-navy dark:text-paper">Review this application</p>
          <textarea
            placeholder="Remarks (optional, required for rejection or correction requests)"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="mb-3 w-full rounded border border-navy-100 bg-white px-3 py-2 text-sm dark:border-navy-400 dark:bg-navy-900 dark:text-paper"
            rows={3}
          />
          {error && <p className="mb-3 text-sm text-crimson">{error}</p>}
          <div className="flex gap-3">
            <Button disabled={submitting || !hasVerifiedPayment} onClick={() => act("APPROVE")} title={!hasVerifiedPayment ? "Requires a verified payment" : undefined}>
              Approve
            </Button>
            <Button variant="secondary" disabled={submitting} onClick={() => act("REQUEST_CORRECTION")}>
              Request correction
            </Button>
            <Button variant="danger" disabled={submitting} onClick={() => act("REJECT")}>Reject</Button>
          </div>
          {!hasVerifiedPayment && (
            <p className="mt-2 text-xs text-navy-400 dark:text-navy-100">
              Approve is disabled until a payment above shows a Paid / Manually Verified status.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-navy-400 dark:text-navy-100">{label}</dt>
      <dd className="text-right text-navy dark:text-paper">{value}</dd>
    </div>
  );
}
