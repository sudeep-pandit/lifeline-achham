import { Suspense } from "react";
import { Card } from "../../../components/ui/card";
import { PaymentResultContent } from "./payment-result-content";

// The gateway redirects the payer's browser here after checkout. This page
// is intentionally NOT the source of truth for payment success (Section 10:
// never trust the redirect alone) - the actual verification happens
// server-side via POST /payments/public/:id/verify, called using the
// gateway's own reference once a specific gateway's callback contract is
// finalized against live merchant credentials.
//
// This file is a plain Server Component (no "use client") specifically so
// `dynamic = "force-dynamic"` is valid here - it tells Next.js to never try
// to statically prerender this page at build time, since it only ever
// makes sense per-request (after a real redirect with real query params).
// The actual useSearchParams() call lives in the client child component,
// wrapped in Suspense as the App Router requires.
export const dynamic = "force-dynamic";

export default function PaymentResultPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 dark:bg-navy-900">
      <Suspense fallback={<Card className="w-full max-w-md text-center">Loading…</Card>}>
        <PaymentResultContent />
      </Suspense>
    </main>
  );
}
