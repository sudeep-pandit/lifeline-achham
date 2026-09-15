# Database plan — phases 2 through 7

Phase 1 implements: `organizations`, `organization_settings`, `users`,
`sessions`, `login_activity`, `roles`, `permissions`, `role_permissions`,
`user_roles`, `audit_logs`, `document_sequences`, `system_settings`.

Phase 2 (implemented) adds: `districts`, `municipalities`,
`membership_types`, `membership_applications`, `application_status_history`,
`members`. See `apps/api/prisma/schema.prisma`. All 77 districts are
seeded by name; Achham's 10 municipalities/rural municipalities are seeded
in full as a real, complete example — other districts' municipalities can
be added through the same `municipalities` table without a schema change
(see `apps/api/prisma/nepal-data.seed.ts`).

**Deviation from Section 38's table list, noted for transparency:** address
fields (district/municipality/ward/tole) and `socialLinks` live directly on
`members` and `membership_applications` rather than in separate
`member_addresses` / `member_social_links` tables. Each member has exactly
one address and a small, rarely-queried set of social links, so the extra
join tables added normalization without a matching benefit; the
district/municipality *reference data* itself is still fully normalized
(`districts` → `municipalities`). Revisit this if a future requirement
needs multiple addresses per member.

Each later phase adds its own tables as a new Prisma migration, so the app
keeps running after every phase (per the project's own phased build plan).
This is the planned shape for each — final field lists will be refined
against real application forms during each phase, but the relationships and
constraints below are the intended design:

## Phase 3 — Payments (implemented)
- `payments` (amount, method, status enum from Section 10, application_id,
  gateway reference, offline reference/recorder/verifier)
- `payment_transactions` (raw gateway callback/verification payloads, kept
  separately from `payments` so verification is auditable and payments are
  never marked successful from a redirect alone — server-side verification
  writes both rows in one transaction)

**Deviation, noted for transparency:** Section 38 lists a separate
`payment_methods` table. Since the method set is fixed by which gateways
the organization has actually integrated (not user-creatable like
membership types), it's modeled as a `PaymentMethodType` enum instead —
same reasoning as the Phase 2 address-table deviation above. Online
gateway integrations themselves (eSewa/Khalti/ConnectIPS) are built as a
`PaymentGatewayProvider` interface with one class per gateway (see
`apps/api/src/payments/gateways/`), so adding a new gateway later never
touches `PaymentsService` or the controller. **Field names and signing
schemes in those gateway classes are structured from each gateway's
general public integration pattern and are explicitly flagged in code
comments as needing verification against that gateway's current official
merchant documentation before going live** — none of them will report a
payment as successful without real, working credentials; `isConfigured()`
returns false and the checkout attempt fails cleanly otherwise.

## Phase 4 — Documents (implemented)

**Update:** the "no template editor" deviation noted below has been
superseded — `document_templates` now supports full multi-template
create/edit/duplicate/delete/set-default/preview for both card and
certificate types, with a real drag/resize/rotate/layer canvas designer at
`/dashboard/documents/designer`, per-template reference images (JPG/PNG,
guide-only, never printed), and per-template custom font upload (.ttf/.otf)
for Nepali/Devanagari text. Card/certificate generation checks for the
org's default template first and only falls back to the original
hardcoded layout described below if none exists — so generation never
breaks for an org that hasn't opened the designer. Bulk generation
(`/dashboard/documents/bulk`) covers both: ID cards as a 5×2-per-A4-sheet,
duplex-ready front/back PDF; certificates as one combined PDF, one per
page. One documented simplification: element rotation pivots from the
element's own corner (pdf-lib's native anchor), not its visual center —
true center-pivot rotation needs pdf-lib's low-level content-stream
operators, which is real, buildable work but meaningfully more code than
this pass covered.

**Also added:** `payments.applicationId` is now optional, with a new
`payments.memberId` alternative — Billing for a member added directly
(via "Add Member," no online application) creates a `Payment` linked by
`memberId` instead, reusing the exact same verification/income/receipt
pipeline as application-based payments. See `/dashboard/billing`.

- `temporary_registrations` (its own table, one per application, issued
  automatically the moment a payment is verified — see `PaymentsService`)
- Membership cards and certificates reuse `Member.cardNumber` /
  `Member.certificateNumber` (already on the table since Phase 2), assigned
  lazily the first time each PDF is generated
- Receipts reuse `Payment.receiptNumber`, assigned the same way
- A shared PDF layer (`apps/api/src/documents/pdf/`) provides A4
  portrait/landscape page setup, header/footer with page numbers, a
  configurable watermark (driven by `OrganizationSettings`, not
  hard-coded), signature-line drawing, and QR code embedding — every
  document type in this phase is built from these same primitives

**Deviations, noted for transparency:**
- **No `document_templates` table.** Section 14 asks for "a reusable
  certificate template system so the Super Admin can change templates
  later." This phase ships one well-built default layout per document type
  instead of a template editor — building an actual template *editor* is a
  meaningfully larger feature (a document-templating UI + safe rendering of
  admin-supplied layouts) that didn't fit this increment. The PDF drawing
  code is factored so a template system could sit in front of it later
  without a rewrite.
- **Receipts ship as one-per-A4 only.** Section 16's 2-up and 4-up
  cut-and-trim layouts aren't built yet — same `ReceiptsService`, just a
  different page layout, planned as a fast follow.
- **Photos aren't embedded on membership cards.** `Member.profilePhotoUrl`
  exists but there's no upload flow yet (Phase 2 didn't add file uploads);
  the card draws a labeled placeholder box instead of fabricating a photo.
- **Organization logo isn't embedded in generated PDFs yet**, even though
  `OrganizationSettings.logoUrl` exists — embedding it needs to fetch and
  decode whatever image format is uploaded there, which is real work
  deferred to when file uploads (Phase 7's storage work) land.
- **Nepali Unicode font isn't bundled** (see
  `apps/api/assets/fonts/README.md`) — no network access was available
  while building this to fetch a real font file, so English text renders
  correctly today and Devanagari text will render as blank boxes until a
  `.ttf` is added to that folder. The embedding code is already written and
  picks it up automatically once it's there.
- **One additional public verification route beyond Section 24's three
  named examples**: `/verify/application/:applicationNumber`, so a
  temporary registration's QR code has something to verify against too.

## Phase 5 — Finance (implemented)
- `income_categories`, `income` — seeded with Membership, Donation, Grant,
  Program Income, Other. "Membership" is looked up by exact name when a
  verified payment auto-creates its income row, so renaming or deleting it
  would silently stop that automation (an intentional fail-safe: it skips
  rather than guessing a category, see `PaymentsService`).
- `expense_categories`, `expenses` — seeded with Office, Transportation,
  Printing, Stationery, Salary, Communication, Program, Training, Event,
  Other.
- Both link to `document_sequences` for LA-INC-/LA-EXP- numbering and to
  `users` for created_by/approved_by, matching Section 18–20's audit needs.
- `Income.relatedPaymentId` (unique) makes the payment→income automation
  idempotent, and gets backfilled with `relatedMemberId` once the
  application is approved and a Member exists (the payment happens before
  approval, so that link can't be made at verification time).
- The dashboard's income/expense/balance cards and the Finance page's
  summary now both compute from real `Income`/`Expense` rows, using the
  same formula: **Current Balance = Total Verified Income − Total Approved
  Expenses** (Section 20), always computed fresh rather than cached.

**Deviations, noted for transparency:**
- **No dedicated category-management screen.** Categories are seeded and
  listable/selectable in the Income/Expense forms, but creating a new
  category is an API call (`POST /finance/income-categories` etc., gated
  on the same `finance.income`/`finance.expenses` permission as recording
  entries) with no admin UI yet — Section 19's "Allow Super Admin to
  create categories" is implemented at the API level, not the UI level.
- Non-membership income (donations, grants) and all expenses require
  manual approval via `finance.approve` before they count toward the
  balance; only the auto-generated membership income self-approves, since
  the payment verification that created it already was the approval step.

## Phase 6 — Reports (implemented)
No new tables, as planned — every report in `ReportsService` is a query
over tables from earlier phases, generated on demand. All three groups
from Section 21 are covered:
- **Member Reports**: all/active/expired/lifetime/yearly, by district, by
  municipality, by ward, by membership type
- **Financial Reports**: income, expenses, income vs expenses, daily/
  monthly/yearly collection, membership revenue, by payment method,
  outstanding balance (unpaid applications)
- **Administrative Reports**: user activity, membership approvals,
  pending/rejected applications, generated cards/certificates/receipts

Every report shares one code path (`report-table-pdf.util.ts` +
`ReportsController.respond()`) for both JSON (on-screen table, the
default) and paginated, watermarked, page-numbered A4 PDF (`?format=pdf`,
Section 22) — so pagination and formatting behave identically across all
~20 report types instead of being reimplemented per report.

**Deviation, noted for transparency:** "Date-wise Members" (Section 21)
isn't a separate report — it's the `from`/`to` filter already available on
the "All Members" view, since a dedicated date-only report would just be
the same table with a narrower filter.

## Phase 7 — Advanced (implemented)
- `notifications` (organization_id, user_id, type, title, message, link,
  related_record_id for de-duplication, is_read) — in-app only for now, by
  design: `NotificationsService.notifyByPermission()` is the one place
  every trigger calls through, so adding email/SMS/WhatsApp later is a
  change to that one method, not to every call site (Sections 25, 30, 31
  called this out explicitly as something to design for).
- `backups` (type, status, file_path, file_size_bytes, created_by,
  timestamps) — the dump files themselves live on local disk at
  `BACKUP_DIR` by default, not the database; pointing that at a mounted
  object-storage volume is a deployment-level choice, not a code change.

**What's real vs. what needs your infrastructure:**
- **Notifications** fire for real, in-process, at every trigger point
  listed in Section 25 that this app can actually detect (new application,
  payment success/failure, membership approval, expense pending approval,
  membership expiring soon). Delivery is in-app only (a polling bell in
  the topbar) — no email/SMS/WhatsApp sender is wired up, per the "design
  so it can be added later" instruction rather than "build all four
  channels."
- **Backups** shell out to the real `pg_dump`/`psql` client tools against
  `DATABASE_URL` — this is the standard, officially-supported way to do
  Postgres backup/restore, not a custom reimplementation. It was **not**
  exercised end-to-end while building this (no Postgres/pg_dump available
  in the sandbox that built it) — smoke-test it against your actual
  deployment before relying on it. Automatic scheduling uses an in-process
  cron (`@nestjs/schedule`, off by default via `BACKUP_AUTOMATIC_ENABLED`),
  which only fires while the API process stays running; an external
  scheduler hitting `POST /backups` is a reasonable alternative for
  deployments that restart the process often.
- **AI Assistant** answers the six example questions from Section 31 (and
  close rephrasings) from a fixed set of read-only, permission-checked
  query handlers — there is no write/delete handler in that set, so "must
  never bypass authorization or take destructive actions" holds by
  construction. An optional call to the Anthropic API (`AI_API_KEY`) only
  rephrases the already-computed factual answer; it never generates the
  numbers, and a missing/failing API call falls back to the plain factual
  sentence rather than blocking the response. Questions outside the fixed
  set get an honest "I don't have a query for that yet" rather than an
  invented answer — broader natural-language understanding (arbitrary
  questions translated to arbitrary safe queries) is a materially bigger
  feature than this phase's scope.

All new tables follow the same conventions as Phase 1: UUID primary keys,
`created_at`/timestamps, and foreign keys enforced at the database level.
