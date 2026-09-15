import Link from "next/link";
import { Card } from "../../../../components/ui/card";

// Card/certificate generation lives on the Members row it belongs to, and
// temporary registration generation lives on the relevant Applications
// detail page, since each document only makes sense in that context. This
// page is the sidebar's landing spot for "Documents" and points there
// directly rather than duplicating those actions in a third place.
export default function DocumentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl text-navy dark:text-paper">Documents</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="mb-2 font-display text-lg text-navy dark:text-paper">Temporary Registration</p>
          <p className="mb-4 text-sm text-navy-400 dark:text-navy-100">
            Issued automatically once an application's payment is verified. Download it from that
            application's detail page.
          </p>
          <Link href="/dashboard/applications" className="text-sm text-navy underline hover:text-crimson dark:text-paper">
            Go to Applications
          </Link>
        </Card>
        <Card>
          <p className="mb-2 font-display text-lg text-navy dark:text-paper">Membership Cards</p>
          <p className="mb-4 text-sm text-navy-400 dark:text-navy-100">
            Generate a front/back membership card PDF for any approved member, or design its theme.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/members" className="text-sm text-navy underline hover:text-crimson dark:text-paper">
              Go to Members
            </Link>
            <Link href="/dashboard/documents/designer?type=CARD" className="text-sm text-navy underline hover:text-crimson dark:text-paper">
              Open Card Designer
            </Link>
            <Link href="/dashboard/documents/bulk?type=CARD" className="text-sm text-navy underline hover:text-crimson dark:text-paper">
              Bulk generate (A4 sheet)
            </Link>
          </div>
        </Card>
        <Card>
          <p className="mb-2 font-display text-lg text-navy dark:text-paper">Certificates</p>
          <p className="mb-4 text-sm text-navy-400 dark:text-navy-100">
            Generate an A4 landscape membership certificate for any approved member, or design its theme.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/members" className="text-sm text-navy underline hover:text-crimson dark:text-paper">
              Go to Members
            </Link>
            <Link href="/dashboard/documents/designer?type=CERTIFICATE" className="text-sm text-navy underline hover:text-crimson dark:text-paper">
              Open Certificate Designer
            </Link>
            <Link href="/dashboard/documents/bulk?type=CERTIFICATE" className="text-sm text-navy underline hover:text-crimson dark:text-paper">
              Bulk generate
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
