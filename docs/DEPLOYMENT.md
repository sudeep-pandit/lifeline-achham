# Deploying Lifeline Achham to a live website

Three pieces need to go live, in this order: **database → API → website**.
This guide uses Railway (API + Postgres) and Vercel (the Next.js site)
because both deploy straight from a GitHub repo with almost no server
config — a good default for a small org without dedicated DevOps. A VPS
alternative is at the bottom if you want full control instead.

## 0. Push the code to GitHub

You need a git repo before any of these platforms can deploy it.

```bash
cd lifeline-achham
git init
git add .
git commit -m "Initial commit"
```
Create an empty repo on GitHub, then:
```bash
git remote add origin https://github.com/<you>/lifeline-achham.git
git push -u origin main
```

## 1. Database + API — Railway

This repo includes `apps/api/railway.json` (config-as-code), so Railway
picks up the build command, start command, and healthcheck automatically —
you no longer need to type those into the dashboard by hand. What's left
is genuinely one-time setup that only a human clicking "yes, deploy this"
can do (creating the project, choosing which repo, and entering secrets):

1. Go to [railway.app](https://railway.app), sign in with GitHub.
2. **New Project → Deploy from GitHub repo** → pick `lifeline-achham`.
3. Railway will try to auto-detect a service — delete that guess and add
   two things manually instead:
   - **New → Database → PostgreSQL** (this gives you a `DATABASE_URL`
     automatically — copy it, you'll need it below).
   - **New → GitHub Repo** again for the API service. Set only:
     - **Root directory**: `apps/api`
     
     Leave **Build command** and **Start command** blank — Railway reads
     both from `apps/api/railway.json` automatically. (If you ever want
     to override either without editing the file, anything typed into
     the dashboard takes priority over the config file.)
4. On the API service, open **Variables** and set everything from
   `.env.example`'s `apps/api/.env` section, with these changes for
   production:
   - `DATABASE_URL` → the one Railway generated for the Postgres service
     (Railway lets you reference it as `${{Postgres.DATABASE_URL}}`)
   - `NODE_ENV=production`
   - `AUTH_COOKIE_SECURE=true` (cookies over HTTPS only — Railway gives
     you HTTPS by default)
   - `AUTH_JWT_SECRET` / `AUTH_REFRESH_SECRET` → generate real random
     values, e.g. `openssl rand -base64 32` — never reuse the placeholder
   - `APP_URL` → the Railway-generated URL for this service (you'll see
     it after first deploy, looks like `https://xxx.up.railway.app`)
   - `WEB_URL` → the Vercel URL you'll get in step 2 (comes back to this
     after that step)

   **Secrets can never live in a committed file** (`railway.json` or
   otherwise) — this step stays manual on every platform, permanently,
   by design. Anything claiming to "automate" this away is a security
   problem, not a convenience.
5. Deploy. Once it's up, confirm `https://<your-api-domain>/api/v1/health`
   returns `{"status":"ok",...}` — Railway's own healthcheck (defined in
   `railway.json`) polls this same endpoint before marking a deploy
   healthy, so if you see this manually, Railway already agrees.
6. Run the seed **once**, from your own machine, pointed at the
   production database:
   ```bash
   cd apps/api
   DATABASE_URL="<railway's DATABASE_URL>" npm run prisma:seed
   ```
   Then **immediately change the seeded Super Admin password** (or delete
   the sample users and create real ones) — `ChangeMe123!` must never
   reach a real deployment. See "Post-deploy checklist" below.

From here on, every `git push` to `main` redeploys automatically with the
same settings — no more dashboard visits needed for routine deploys.

## 2. Website — Vercel

`apps/web/vercel.json` pins the framework explicitly; Vercel's own
npm-workspace detection already handles the install/build commands
correctly for this repo layout without needing overrides (confirmed by
your working deploy) — so the only manual steps are project creation,
Root Directory, and environment variable values, same reasoning as
Railway above.

1. Go to [vercel.com](https://vercel.com), sign in with GitHub.
2. **Add New → Project** → pick the same `lifeline-achham` repo.
3. **Root Directory**: `apps/web`
4. **Environment Variables**:
   - `NEXT_PUBLIC_API_URL` → the Railway API URL from step 1
   - `NEXT_PUBLIC_ORGANIZATION_ID` → `00000000-0000-0000-0000-000000000001`
     (the seeded org id — only needed if you keep it; single-tenant as-is)
5. Deploy. Vercel gives you a URL like `https://lifeline-achham.vercel.app`.
6. Go back to Railway and set the API's `WEB_URL` to that Vercel URL —
   this is what CORS uses to allow the frontend to call the API.

From here on, every `git push` to `main` redeploys automatically here too.

## 3. Custom domain (optional)

- **Vercel** (website): Project → Settings → Domains → add
  `lifelineachham.org.np` (or whatever you own) → follow the DNS
  instructions (usually a CNAME or A record at your domain registrar).
- **Railway** (API): Service → Settings → Networking → add a custom
  domain, e.g. `api.lifelineachham.org.np`.
- After both are live on your real domain, update `APP_URL` (Railway) and
  `NEXT_PUBLIC_API_URL` (Vercel) to the real domains and redeploy both.

## 4. Post-deploy checklist

- [ ] Changed or removed every seeded `[SAMPLE]` user — see
      `apps/api/prisma/seed.ts` for the list; log in and either change
      passwords or disable/delete them from **Users & Roles**.
- [ ] `AUTH_JWT_SECRET` / `AUTH_REFRESH_SECRET` are real random values,
      not the placeholders.
- [ ] `AUTH_COOKIE_SECURE=true` on the API.
- [ ] Filled in real organization details at **Settings** (name, PAN/VAT,
      address, prefixes, watermark) — nothing should say "Lifeline
      Achham" as a placeholder if that's not actually accurate anymore.
- [ ] Added a real Unicode font at `apps/api/assets/fonts/` if Nepali
      text needs to render in PDFs (see that folder's README) — you'll
      need to redeploy the API after adding it.
- [ ] Set real payment gateway credentials (`ESEWA_*`, `KHALTI_*`,
      `CONNECTIPS_*`) once you've completed merchant onboarding with each
      — until then, online payment buttons correctly show as unavailable.
- [ ] Set `AI_API_KEY` if you want the AI Assistant's answers phrased
      conversationally (optional — it works without one).
- [ ] Installed `pg_dump`/`psql` wherever backups will run (Railway's
      containers may not have these by default — see the note below), or
      use Railway's own built-in Postgres backup feature instead of this
      app's `/backups` page.
- [ ] Confirmed HTTPS is active on both the API and website domains
      (Railway/Vercel both do this automatically) — never run this over
      plain HTTP once real member data is involved.

**Note on backups on Railway specifically:** Railway's own Postgres
service has built-in automated backups you can enable in its dashboard —
that's simpler and more reliable than this app's `/backups` page for a
managed database, since Railway's containers don't ship `pg_dump` by
default. This app's backup feature is built for the case where you're
running your own Postgres (the VPS path below, or an on-prem server).

## Alternative: running the API on Vercel instead of Railway

The API can also run on Vercel as a serverless function — `apps/api/api/index.ts`
and `apps/api/vercel.json` in this repo set that up. Import `apps/api` as
its own Vercel project the same way you imported `apps/web`, set the same
environment variables as the Railway setup above (`DATABASE_URL`,
`AUTH_JWT_SECRET`, etc. — still pointing at a real Postgres instance
somewhere, e.g. Railway's, Vercel's own Postgres integration, Supabase,
or Neon), and deploy.

**Two things genuinely don't work the same way on Vercel, and no amount of
configuration changes that — worth knowing before you commit to this path:**

1. **The automatic backup cron job never fires.** `BackupsSchedulerService`
   needs a process that stays alive continuously; Vercel functions only
   exist for the duration of a single request. Manual backups
   (`POST /backups`, triggered from the Backups page) still work fine on
   Vercel. If you want automatic backups on a schedule while hosting the
   API on Vercel, use an external scheduler (a free cron service like
   cron-job.org, or a scheduled GitHub Action) to call `POST /backups`
   periodically instead of relying on `BACKUP_AUTOMATIC_ENABLED`.
2. **The Backups feature's `pg_dump`/`psql` shell-outs will fail at
   runtime** unless those binaries happen to be present in Vercel's
   function environment, which isn't guaranteed and isn't something you
   control the way you can on a normal server. If backups matter to you,
   keep the API on Railway (or any host where you control the OS image)
   even if you run everything else on Vercel.

Everything else — auth, members, payments, documents, finance, reports,
notifications, the AI assistant — runs the same either way, with one
practical trade-off: **cold starts.** A Vercel function that hasn't been
hit in a while pays the full NestJS bootstrap cost (roughly 1–3 seconds)
on the next request, since nothing stays warm between requests the way a
Railway process does. For a small org's admin tool this is usually a
non-issue; for anything with tighter response-time expectations, Railway
(or the VPS path below) avoids it entirely.

## Alternative: a single VPS (more control, more setup)

If you'd rather run everything on your own server (DigitalOcean, Linode, a
local machine, etc.) instead of Railway/Vercel:

1. Provision an Ubuntu server, install Docker and Docker Compose.
2. Use `docker-compose.yml` in this repo as your starting point for
   Postgres — add two more services to it for the API and web app (each
   with a `Dockerfile` you'll need to add — a Node 20 image running
   `npm run build` then `npm run start` for each).
3. Put [Caddy](https://caddyserver.com) or nginx in front as a reverse
   proxy — Caddy is the easiest way to get automatic HTTPS via Let's
   Encrypt with almost no config:
   ```
   lifelineachham.org.np {
     reverse_proxy web:3000
   }
   api.lifelineachham.org.np {
     reverse_proxy api:4000
   }
   ```
4. Point your domain's DNS A records at the server's IP.
5. Everything else (env vars, migrations, seeding, the checklist above)
   is the same as the Railway path.

This gives you full control (and `pg_dump`/`psql` are trivial to install
for the built-in backup feature) at the cost of managing the server
yourself — updates, security patches, monitoring, disk space, all on you.
