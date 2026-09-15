"use client";

import { useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../lib/api-client";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { StatusBadge } from "../../components/ui/badge";

interface TrackResult {
  applicationNumber: string;
  status: string;
  membershipType: string;
  submittedAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Public: lets an applicant check their own application without logging in,
// using only the application number they were given at submission (Section
// 44 - no other identifying detail is required or exposed).
export default function TrackApplicationPage() {
  const [applicationNumber, setApplicationNumber] = useState("");
  const [result, setResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const data = await apiFetch<TrackResult>(`/applications/track?applicationNumber=${encodeURIComponent(applicationNumber)}`);
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to find that application.");
    } finally {
      setLoading(false);
    }
  }

  const paymentDone = result && !["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(result.status);

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-10 dark:bg-navy-900">
      <Card className="w-full max-w-md">
        <p className="mb-4 font-display text-xl text-navy dark:text-paper">Track your application</p>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="LA-APP-0001"
            value={applicationNumber}
            onChange={(e) => setApplicationNumber(e.target.value)}
            required
          />
          <Button type="submit" disabled={loading}>{loading ? "Checking…" : "Check"}</Button>
        </form>

        {error && <p className="mt-4 text-sm text-crimson">{error}</p>}

        {result && (
          <div className="mt-6 flex flex-col gap-3 border-t border-navy-100 pt-4 dark:border-navy-600">
            <div className="flex items-center justify-between">
              <span className="text-sm text-navy-400 dark:text-navy-100">{result.applicationNumber}</span>
              <StatusBadge status={result.status} />
            </div>
            <p className="text-sm text-navy-400 dark:text-navy-100">Membership type: {result.membershipType}</p>
            <p className="text-sm text-navy-400 dark:text-navy-100">
              Submitted {new Date(result.submittedAt).toLocaleDateString()}
            </p>

            {paymentDone ? (
              <a
                href={`${API_URL}/api/v1/documents/temporary-registrations/public/${result.applicationNumber}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block rounded bg-navy px-4 py-2 text-center text-sm text-paper hover:bg-navy-600 dark:bg-crimson"
              >
                Download temporary registration
              </a>
            ) : (
              <p className="text-sm text-navy-400 dark:text-navy-100">
                Your temporary registration will be available here once payment is verified.
              </p>
            )}
          </div>
        )}
      </Card>
    </main>
  );
}
