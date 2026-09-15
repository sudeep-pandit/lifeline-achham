import { Suspense } from "react";
import { BulkGenerateContent } from "./bulk-content";

export const dynamic = "force-dynamic";

export default function BulkGeneratePage() {
  return (
    <Suspense fallback={<div className="p-6 text-navy-400 dark:text-navy-100">Loading…</div>}>
      <BulkGenerateContent />
    </Suspense>
  );
}
