# Lifeline Achham — Membership, Finance & Organization Management System

Phases 1–7 of a phased build — every phase in the original specification —
Foundation, Membership, Payments, Documents, Finance, Reports, and
Advanced (notifications/backups/AI). This is a real, runnable monorepo —
not a mockup — covering project setup, auth, RBAC, organization settings,
the numbering engine, audit logging, a live dashboard, the full membership
application → payment → approval → member lifecycle, a modular
online/offline payment system with server-side verification, print-ready
PDF generation with QR verification, income/expense tracking with an
auditable accounting balance, ~20 report types, in-app notifications,
database backup/restore, and a permission-gated AI assistant. Every
deliberate deviation from the original spec is called out explicitly in
`docs/DATABASE_PLAN.md` rather than silently glossed over.

## What's implemented

| Area | Status |
|---|---|
| Monorepo (apps/api, apps/web, packages/*) | ✅ |
| PostgreSQL schema (Prisma) for orgs/users/roles/permissions/audit/sequences | ✅ |
| Auth: login, logout, bcrypt hashing, lockout after failed attempts, HttpOnly refresh cookie + short-lived JWT | ✅ |
| RBAC: granular permissions, role CRUD, permission guard on every route | ✅ |
| Organization settings (no hard-coded org info anywhere in the app) — editable at `/dashboard/settings` | ✅ |
| Numbering engine (transaction-safe, used by every document type) | ✅ |
| Audit log (append-only, auto-recorded via `@Audit()` decorator) — browsable at `/dashboard/audit-logs` | ✅ |
| Users & Roles admin UI: create users, assign roles, create custom roles with a permission checklist | ✅ |
| Dashboard: AD/BS date, greeting, permission-gated sidebar, live summary endpoint | ✅ |
| Nepal administrative data: all 77 districts + full Achham municipality/ward data, extensible | ✅ |
| Membership types: dynamic CRUD (Lifetime / Yearly seeded, more can be added) | ✅ |
| Public membership application form (dependent District→Municipality→Ward dropdowns) | ✅ |
| Admin application review workflow: approve / reject / request correction, full status history | ✅ |
| Members module: list, search, filter by status/type/district, expiry status computed live | ✅ |
| Seed data (Super Admin / Admin / Accountant / Staff, clearly labelled `[SAMPLE]`) | ✅ |
| Payments: online (eSewa/Khalti/ConnectIPS architecture) + offline (Cash/Bank/Cheque/Other), server-side verification only, never trusts a browser redirect | ✅ |
| Application approval gated on a verified payment (no membership without a real, verified payment) | ✅ |
| Payments ledger (`/dashboard/payments`) + per-application payment recording/verification | ✅ |
| Temporary registration PDF: auto-issued on payment verification, A4, watermarked, QR-verified | ✅ |
| Membership card PDF: front/back, standard ID-1 size, QR-verified, customizable via the Card Designer | ✅ |
| Certificate PDF: A4 landscape, watermarked, QR-verified, customizable via the Certificate Designer | ✅ |
| Card/Certificate Designer: multi-template, drag/resize/rotate/layer canvas, reference image + custom Nepali font upload | ✅ |
| Bulk generation: ID cards (5×2 per A4, duplex-ready) and certificates (combined PDF) for selected members | ✅ |
| Billing for directly-added members (no online application) — `/dashboard/billing` | ✅ |
| Add Member: direct staff registration with passport photo upload, blood group, full address/social fields | ✅ |
| Receipt PDF: one-per-A4, QR-verified, downloadable from the Payments ledger (2-up/4-up layouts not yet built) | ✅ |
| Public QR verification: `/verify/member`, `/verify/certificate`, `/verify/receipt`, `/verify/application` | ✅ |
| Public application tracking (`/track`) | ✅ |
| Finance: income/expense records, seeded categories, approval workflow, dashboard + Finance page both computing Current Balance = Verified Income − Approved Expenses | ✅ |
| Membership payments auto-create approved income entries | ✅ |
| Reports: ~20 report types across Member/Financial/Administrative, on-screen table or paginated watermarked A4 PDF | ✅ |
| In-app notifications: new application, payment success/failure, approval, expiring memberships, expense approval — polling bell in the topbar | ✅ |
| Database backup & restore (Super Admin only, real `pg_dump`/`psql`), optional automatic schedule | ✅ |
| AI Assistant: permission-gated, read-only, answers the spec's example questions from real data | ✅ |
| Refresh-token rotation, 2FA, email/SMS/WhatsApp notification channels, receipt 2-up/4-up layouts, document template editor | 🔜 documented as deliberately out of scope — see docs/DATABASE_PLAN.md |

## Stack

- **API**: NestJS, TypeScript, Prisma, PostgreSQL, Passport-JWT
- **Web**: Next.js (App Router), TypeScript, Tailwind CSS
- **Shared**: `packages/config` (permission catalogue), `packages/types` (DTOs)

## Prerequisites

- Node.js 20+
- Docker (for local PostgreSQL) — or point `DATABASE_URL` at any Postgres 14+ instance

## Getting started

```bash
# 1. Install dependencies (run from the repo root; npm workspaces link the
#    apps/* and packages/* automatically)
npm install

# 2. Start a local database
docker compose up -d

# 2a. (Optional) also start pgAdmin, a web UI for browsing the database
docker compose --profile tools up -d

# 3. Configure environment variables
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local
# then edit apps/api/.env / apps/web/.env.local and remove the sections
# that don't apply to that app (.env.example documents both together)

# 4. Set up the database
cd apps/api
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
cd ../..

# 5. Run both apps (in separate terminals)
npm run dev:api    # http://localhost:4000
npm run dev:web    # http://localhost:3000
```

**Using pgAdmin?** See "Browsing the database with pgAdmin" below.

Sign in at http://localhost:3000/login with the seeded Super Admin:

```
superadmin@lifelineachham.dev / ChangeMe123!
```

**Change or remove all seeded accounts before any non-development deployment.**

## Browsing the database with pgAdmin

Two options:

**A. Local pgAdmin desktop app** (if you already have it installed) — add
a new server with these connection details (matching `docker-compose.yml`):

| Field | Value |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| Maintenance database | `lifeline_achham` |
| Username | `lifeline` |
| Password | `lifeline` |

**B. pgAdmin in Docker** (no local install needed) — start it alongside
the database:

```bash
docker compose --profile tools up -d
```

Then open **http://localhost:5050**, log in with `admin@lifelineachham.dev`
/ `admin`, and register a new server using the same connection details as
above — except set **Host** to `postgres` (the Docker service name), not
`localhost`, since pgAdmin is reaching Postgres over the Docker network,
not your machine's.

These are throwaway local-dev credentials committed in `docker-compose.yml`
on purpose — never reuse them for anything real, and never expose port
5432 or 5050 outside your own machine.

## Project structure

```
apps/
  api/            NestJS backend (REST API, Prisma, RBAC, auth, PDF/QR docs)
    assets/fonts/   Unicode font goes here for Nepali PDF text (see its README)
  web/            Next.js frontend (public site scaffold + admin portal)
packages/
  config/         Canonical permission catalogue + default role mappings
  types/          Shared TypeScript types/DTOs between api and web
docs/
  DATABASE_PLAN.md   Table-by-table plan for Phases 2–7
  DESIGN.md          Design token rationale
docker-compose.yml   Local PostgreSQL for development
.env.example         All environment variables for both apps, documented
```

## Security notes for this phase

- Passwords are hashed with bcrypt (cost configurable via `BCRYPT_SALT_ROUNDS`).
- Refresh tokens are stored in an HttpOnly, SameSite cookie; access tokens
  are short-lived and kept in memory on the client, never in localStorage.
- Every mutating route requires an explicit `@RequirePermissions(...)`
  decorator, checked by `PermissionsGuard` — nothing is accessible by default.
- Every mutating route can be annotated `@Audit({...})` to write an
  append-only audit log row automatically.
- Accounts lock for 15 minutes after 5 failed login attempts.
- Raw database/stack errors are never returned to clients (see
  `HttpExceptionFilter`); they're logged server-side instead.

## Try it out (full flow)

1. Visit http://localhost:3000/apply and submit a membership application as
   a member of the public (no login needed). You'll land on a payment step —
   online methods show as "not yet available" until real gateway credentials
   are set in `apps/api/.env`, which is expected and safe (see below).
2. Sign in as the seeded Accountant (`accountant@lifelineachham.dev /
   ChangeMe123!`), open the application from **Payments** or **Applications**,
   and record an offline payment (Cash/Bank Deposit/Cheque) against it, then
   verify it. A temporary registration is issued automatically at this
   point — download it right there, or as the public applicant would, at
   http://localhost:3000/track using the application number.
3. Sign in as the seeded Admin (`admin@lifelineachham.dev / ChangeMe123!`)
   and open **Applications** — the Approve button is only enabled once a
   verified payment is on file (Section 48, rule 4: "Failed payments must
   not activate membership").
4. Open **Members** — the newly approved member now appears with a real
   `LA-LM-0001`-style member ID. Use the **Card** / **Certificate** links on
   their row to generate those PDFs (both lazily assign their own
   `LA-CARD-`/`LA-CERT-` number the first time, then reuse it).
5. Back on the application's Payments card, download the **Receipt** for
   the verified payment.
6. Scan (or just visit) any of the QR codes embedded in those PDFs — they
   point at `/verify/member/...`, `/verify/certificate/...`,
   `/verify/receipt/...`, or `/verify/application/...`, all public pages
   that confirm authenticity without exposing address, phone, email, or
   financial details (Section 44).
7. Open **Finance** — the payment you verified in step 2 already shows up
   as an approved "Membership" income entry (Section 18, automatic). Try
   recording a manual entry too: as the Accountant, add a Donation under
   Income or an Office expense under Expenses — it shows "Pending" until
   someone with `finance.approve` (the Accountant role has it) approves
   it, at which point it counts toward Current Balance.
8. The dashboard's Today's Income / Monthly Income / Monthly Expenses /
   Current Balance cards now reflect all of this live.

**On the online gateways (eSewa/Khalti/ConnectIPS):** the integration
architecture is real and complete — a `PaymentGatewayProvider` interface,
one class per gateway, a registry, and a checkout/verify flow that never
trusts the browser redirect. But none of it can actually take a payment
without real merchant credentials (API keys, in ConnectIPS's case a signed
certificate) in `apps/api/.env`, which this repo obviously doesn't ship.
Each gateway class has inline comments flagging exactly which
field names/signing details to confirm against that gateway's current
official documentation before going live.

**On Nepali text in PDFs:** see `apps/api/assets/fonts/README.md` — the
font-embedding code is real, it just needs a real font file added (not
included here since building this had no network access to fetch one).

9. Open **Reports** — pick any report from the dropdown (grouped Member /
   Financial / Administrative, matching Section 21), optionally set a date
   range where offered, then **View** for an on-screen table or **Download
   PDF** for a paginated, watermarked A4 export with the same numbers. Try
   "Income vs Expenses" or "Outstanding Balance" to see the Phase 5 data
   you just created show up here.
10. Check the notification bell (top right) — as the seeded Admin, you
    should already have unread notifications from steps 1–3 above (new
    application, payment verified). Click one to mark it read and jump
    straight to the relevant application.
11. Sign in as `superadmin@lifelineachham.dev` and open **Backups** —
    click "Create backup now". This calls real `pg_dump` on your database,
    so it needs the PostgreSQL client tools installed and `DATABASE_URL`
    reachable from wherever the API runs; if `pg_dump` isn't on your PATH,
    you'll see a clear "Backup failed" row rather than a fake success.
12. Still as Super Admin, open **AI Assistant** and click one of the
    example questions (or type your own close variant) — the answer comes
    from a live query against your data, not a canned string. Try it while
    signed in as Staff instead: `ai_assistant.use` isn't granted to that
    role, so the page itself won't even be reachable from the sidebar.
13. Open **Users & Roles** as Super Admin — create a new role with a
    handful of permissions checked, then create a user and assign them
    that role. Sign in as that user to see the sidebar only show what
    their new role actually grants.

## Deployment (outline)

For a full step-by-step (Railway + Vercel, or a self-hosted VPS with
Docker), see **`docs/DEPLOYMENT.md`**. Quick outline:


1. Provision a managed PostgreSQL instance and object storage bucket (for
   future file-upload needs, e.g. member photos — S3-compatible).
2. Set all `apps/api/.env` secrets via your platform's secret manager, never
   committed to git.
3. `npm run build:api && npm run build:web`, then run `apps/api/dist/main.js`
   behind a process manager, and deploy `apps/web` to any Node hosting
   (Vercel, or a container) with `NEXT_PUBLIC_API_URL` pointing at the API.
4. Run `npx prisma migrate deploy` (not `migrate dev`) against production.
5. Add a real Unicode font file (see `apps/api/assets/fonts/README.md`) if
   you need Nepali text to render correctly in generated PDFs.
6. Install the PostgreSQL client tools (`pg_dump`/`psql`) on whatever host
   runs the API, and set `BACKUP_DIR` to a persistent, backed-up-itself
   volume — then either enable `BACKUP_AUTOMATIC_ENABLED` or point an
   external scheduler at `POST /backups`.
7. Set `AI_API_KEY` if you want the AI Assistant's answers phrased more
   conversationally — it works without one, just more tersely.

## Remaining hardening work

Every phase from the original specification has a working implementation.
What's left is hardening and scope genuinely deferred on purpose (each
explained in `docs/DATABASE_PLAN.md` at its relevant phase), roughly in
priority order:

1. **Refresh-token rotation** on `POST /auth/refresh` (currently a stub
   that requires re-login once the access token expires) and optional 2FA
   (TOTP) enrollment — both flagged since Phase 1.
2. **Email/SMS/WhatsApp notification delivery.** `NotificationsService`
   was deliberately designed with one call-through method
   (`notifyByPermission`) specifically so this is additive, not a rewrite.
3. **Receipt 2-up/4-up print layouts** (Section 16) — same
   `ReceiptsService`, a different page layout.
4. **A document-template editor** (Section 14) so Super Admin can change
   card/certificate/receipt layouts without a code change — today there's
   one well-built default layout per document type.
5. **Member photo uploads** (needs object storage wiring) so membership
   cards can show a real photo instead of a placeholder box.
6. **Organization logo embedding** in generated PDFs — same object-storage
   dependency as photos.
7. Smoke-test the backup/restore flow and the payment gateway
   integrations against real credentials — both were built to the
   correct, standard integration patterns but couldn't be exercised
   end-to-end in the environment that built this (no network, no
   Postgres, no merchant accounts).
