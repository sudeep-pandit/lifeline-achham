"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api-client";
import { Card } from "./ui/card";
import { ShieldCheck, ShieldX } from "lucide-react";

// Shared display for every /verify/* page (Section 24). Deliberately shows
// only whatever the backend's verify endpoint returns - those endpoints
// are the ones responsible for excluding private/financial data
// (Section 44), not this component.
export function VerifyResult({ endpoint, title }: { endpoint: string; title: string }) {
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Record<string, unknown>>(endpoint)
      .then(setResult)
      .catch(() => setResult({ verified: false }))
      .finally(() => setLoading(false));
  }, [endpoint]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 dark:bg-navy-900">
      <Card className="w-full max-w-sm text-center">
        <p className="mb-4 font-display text-lg text-navy dark:text-paper">{title}</p>
        {loading ? (
          <p className="text-sm text-navy-400 dark:text-navy-100">Checking…</p>
        ) : result?.verified ? (
          <div className="flex flex-col items-center gap-3">
            <ShieldCheck className="text-sage" size={40} />
            <p className="font-medium text-sage">Verified</p>
            <dl className="mt-2 w-full text-left text-sm">
              {Object.entries(result)
                .filter(([key]) => key !== "verified")
                .map(([key, value]) => (
                  <div key={key} className="flex justify-between border-b border-navy-100 py-1 dark:border-navy-600">
                    <dt className="capitalize text-navy-400 dark:text-navy-100">{key.replace(/([A-Z])/g, " $1")}</dt>
                    <dd className="font-medium text-navy dark:text-paper">{String(value)}</dd>
                  </div>
                ))}
            </dl>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <ShieldX className="text-crimson" size={40} />
            <p className="font-medium text-crimson">Not found</p>
            <p className="text-sm text-navy-400 dark:text-navy-100">
              We couldn't verify this. Double-check the number, or contact the organization directly.
            </p>
          </div>
        )}
      </Card>
    </main>
  );
}
