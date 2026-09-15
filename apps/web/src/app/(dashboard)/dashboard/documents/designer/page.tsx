import { Suspense } from "react";
import { DesignerContent } from "./designer-content";

// Plain Server Component wrapper - useSearchParams (used in the client
// child below) requires a Suspense boundary or the build fails, and
// dynamic="force-dynamic" keeps this page from ever being statically
// prerendered (it only ever makes sense per-request, driven by the
// logged-in user's own templates).
export const dynamic = "force-dynamic";

export default function DesignerPage() {
  return (
    <Suspense fallback={<div className="p-6 text-navy-400 dark:text-navy-100">Loading designer…</div>}>
      <DesignerContent />
    </Suspense>
  );
}
