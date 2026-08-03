# Novikontas Staff Suggestion Platform

An internal web app where staff log **one suggestion per week**, and every
suggestion gets an answer. Reminder Friday evening, a second chance Monday
morning, and a rank list scored on what actually gets accepted.

Sign-in is **Google only** — no passwords, no magic links. Right now any
Google account can sign in; set `ALLOWED_EMAIL_DOMAINS` once you're ready to
restrict it to your organisation's own domain(s).

**Stack:** Supabase PostgreSQL · Express · React · Node (PERN) — Prisma,
Tailwind v4, Resend, pg-boss, in a pnpm monorepo, TypeScript throughout.

---

## Prerequisites

- A [Supabase](https://supabase.com) project (free tier is fine) — the database
- A Google Cloud OAuth 2.0 client — sign-in (see below)
- Node 22+, pnpm 9+, Git

No Docker, no local Postgres: the app talks to Supabase from both local dev and
production.

## Run it locally

```bash
npm install -g pnpm
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
```

Fill in `.env`:

```
DATABASE_URL=...          # Supabase project -> Connect -> ORMs/Prisma tab -> pooled URL
DIRECT_URL=...             # same panel -> unpooled URL, used only by db push/migrate
GOOGLE_CLIENT_ID=...       # see "Setting up Google sign-in" below
GOOGLE_CLIENT_SECRET=...
```

Then:

```bash
pnpm setup    # install, push the schema, apply raw.sql, seed settings/categories/test users
pnpm dev      # API :4000, web :5173
```

Open <http://localhost:5173> and sign in with Google.

The steps `pnpm setup` runs, if you would rather do them one at a time:

```bash
pnpm install    # all workspaces + prisma generate
pnpm db:push    # schema straight from schema.prisma, against Supabase
pnpm db:raw     # tsvector column, quota index, vote trigger
pnpm db:seed    # settings, categories, a handful of test users — no suggestions
pnpm dev        # API :4000 · web :5173
```

### If something goes wrong

| Symptom                                            | Cause                                                                                                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Invalid environment` on API start                 | No `.env`, or `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are blank — both are required                                                                                                |
| Port 5173 or 4000 already in use                   | Stop the other process, or change `PORT` in `.env`                                                                                                                                   |
| Can't connect to the database                      | Check `DATABASE_URL`/`DIRECT_URL` — use the password from Supabase's Connect panel (reset it there if forgotten), not your dashboard login                                           |
| `db push`/`db migrate` hangs or errors oddly       | `DIRECT_URL` is missing or still pooled (port 6543) — it must be the unpooled, session-mode URL (port 5432)                                                                          |
| `column "search_vector" ... is a generated column` | `db:push` drops the generated column first and `db:raw` restores it. Always run the two together, in that order                                                                     |

---

## Signing in

Google is the only way in. The authorisation-code flow verifies the ID token's
signature, issuer and audience against Google's published keys before creating
a session.

**Domain restriction is opt-in** via `ALLOWED_EMAIL_DOMAINS` (comma-separated):

- **Blank (current default):** any Google account that passes Google's own
  `email_verified` check can sign in — personal Gmail included.
- **Set:** only Workspace accounts whose verified `hd` claim matches one of the
  listed domains are accepted. This is the state to move to once the
  organisation's Workspace domain is ready to enforce.

### Setting up Google sign-in

1. **Create a project** at <https://console.cloud.google.com> (or reuse one).
2. **APIs & Services → OAuth consent screen.** Choose **Internal** if the
   project sits inside a Workspace you control — that alone stops anyone
   outside the organisation from reaching the consent screen. Choose External
   otherwise.
3. **Credentials → Create credentials → OAuth client ID → Web application.**
   Add the authorised redirect URI, exactly, including the path:

   ```
   http://localhost:4000/api/auth/google/callback     (local)
   https://YOUR-DOMAIN/api/auth/google/callback       (deployed)
   ```

   A mismatch here is the single most common failure — Google compares the
   string character for character.

4. **Copy the client ID and secret into `.env`:**

   ```
   GOOGLE_CLIENT_ID=1234567890-xxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
   ```

5. **Restart the API.**

**When you're ready to restrict to company accounts**, add your domain(s):

```
GOOGLE_HOSTED_DOMAIN=yourdomain.com
ALLOWED_EMAIL_DOMAINS=yourdomain.com
```

`GOOGLE_HOSTED_DOMAIN` is only a cosmetic hint to Google's account chooser — a
caller can strip it from the URL, so nothing security-relevant depends on it.
The real gate is `ALLOWED_EMAIL_DOMAINS`, checked server-side against the
verified `hd` and email claims on the way back from Google.

---

## Test data

The seed (`pnpm db:seed`, or `apps/api/prisma/seed.ts`) creates settings
defaults, the standard categories, and three test users — one admin and two
placeholder staff — with **no suggestions, cycles, votes or comments**.
Replace `TEST_USERS` in that file with the real roster before launch.

To wipe an existing database back down to just those three accounts (e.g. old
demo data from before this rollout):

```bash
pnpm db:reseed    # deletes all suggestions/cycles/votes/comments/etc. and
                  # any user not in TEST_USERS, then re-seeds
```

This is destructive — it deletes every suggestion, cycle, vote, comment and
non-test user. Only run it against a database you mean to reset.

---

## What it does

| Capability         | Detail                                                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Weekly quota       | One per person per ISO week. Enforced in the service layer, the participation ledger, and a partial unique index in Postgres                                              |
| Friday reminder    | 17:00 to anyone who hasn't logged one, skipping opt-outs and hard bounces                                                                                                 |
| Monday grace       | 09:00 final call; submitting before noon still fills last week's slot                                                                                                     |
| Miss ledger        | Monday noon, anything still pending becomes `MISSED`. Admins can mark a week `EXEMPT` for leave or sickness                                                               |
| Rank list          | Scored on accepted and implemented rather than volume. Visibility is admin-controlled                                                                                     |
| Full admin control | Review queue, status transitions with mandatory reasons, assignment with due dates, official responses, internal notes, categories, people, and every behavioural setting |
| Sign-in            | Google OAuth only, domain restriction opt-in                                                                                                                              |
| Audit trail        | Append-only status history plus an audit log for sensitive admin actions                                                                                                  |
| Multilingual       | EN, LV, RU written; LT and KA fall back to EN                                                                                                                             |

### The weekly rhythm

```
Mon 00:05   cycle.open        new cycle + a PENDING row per active user
  …         staff submit      one suggestion fills the week's slot
Fri 17:00   reminder.friday   email everyone still pending
Sun 23:59   on-time deadline
Mon 09:00   reminder.monday   final call for anyone who missed last week
Mon 12:00   cycle.close       remaining pending rows become MISSED
```

Every hour and toggle above is an **admin setting** editable in the UI, so
behaviour changes never need a deployment. Don't wait a week to see it:
**Admin → Controls → Run now** triggers any of the four jobs on demand.

### Scoring

```
implemented   +10      submitted on time   +2
accepted       +5      submitted in grace  +1
vote received  +0.5    missed week         -3
```

One accepted suggestion outweighs two on-time submissions; one implemented
outweighs five. A quota rewards turning up, but turning up cannot out-score being
useful — without that weighting, a weekly quota reliably produces filler logged at
16:55 on Friday.

---

## Deploying

`render.yaml` provisions one Render web service. It does **not** provision a
database — that's Supabase. After the first deploy, paste your Supabase
`DATABASE_URL`, `DIRECT_URL` and Google OAuth credentials into the service's
environment variables in the Render dashboard (they're marked `sync: false` in
the blueprint so Render won't overwrite them).

```bash
git init && git add -A && git commit -m "Suggestion platform"
git remote add origin git@github.com:<you>/<repo>.git
git push -u origin main
```

Then in Render: **New → Blueprint → select the repo → Apply**, then fill in
`DATABASE_URL`, `DIRECT_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (and
optionally `RESEND_API_KEY`) in the service's environment tab.

Add `https://YOUR-RENDER-URL/api/auth/google/callback` as an authorised
redirect URI on the Google OAuth client once you know the Render URL.

**One service, not two.** Express serves the built React app, so there is a
single origin, the session cookie stays first-party, and there is no CORS to
tune.

---

## Commands

| Command                        | Does                                                                 |
| -------------------------------- | --------------------------------------------------------------------- |
| `pnpm setup`                    | Everything but the servers: install, schema, raw SQL, seed            |
| `pnpm dev`                      | API and web together, both hot-reloading                              |
| `pnpm dev:api` / `pnpm dev:web` | One at a time                                                          |
| `pnpm db:seed` / `pnpm db:reseed` | Seed, or wipe transactional data and re-seed                         |
| `pnpm db:push`                  | Apply `schema.prisma` directly — no migration files                   |
| `pnpm db:migrate`               | Proper migration history, for real deployments                        |
| `pnpm db:raw`                   | Re-apply `raw.sql`                                                    |
| `pnpm db:studio`                | Prisma Studio — a GUI over the data                                   |
| `pnpm typecheck`                | All four packages                                                     |
| `pnpm build`                    | Production build of the frontend                                      |

`db:push` and `db:raw` are a pair and belong together, in that order: the push
drops the generated `search_vector` column — Prisma cannot describe a generated
column, so leaving it in place makes the second push fail — and `raw.sql`
recreates it with its GIN index. Nothing is lost; every value in it is derived
from title and body.

`db:push` needs no migration files, which is why `pnpm setup` and the Render
release step use it. For a real deployment consider switching to
`pnpm db:migrate`, which writes migration history and folds `raw.sql` into the
migration so the next `migrate dev` doesn't see drift.

---

## Repository layout

```
render.yaml               Render blueprint — web service only (database is Supabase)
apps/
  api/                    Express + Prisma
    scripts/
      prisma.mjs          Runs the Prisma CLI with the root .env loaded
    prisma/
      schema.prisma       Data model
      raw.sql             tsvector column, quota index, vote trigger
      apply-raw.ts        Applies raw.sql through Prisma (no psql needed)
      append-raw.mjs      Folds raw.sql into a migration, for real deployments
      seed.ts             Settings, categories, test users — no suggestions
    src/
      lib/time.ts         ISO week maths in Europe/Riga
      services/cycles.ts  Open, grace window, close, miss ledger
      services/ranking.ts Leaderboard aggregation and streaks
      jobs/index.ts       pg-boss schedules
      routes/             auth · google · suggestions · admin · webhooks · misc
      services/session.ts Session cookie
  web/                    React + Vite + Tailwind v4
    src/components/WatchStrip.tsx   The week, drawn
    src/pages/            login · submit · my log · detail · board · ranks · settings
    src/pages/admin/      review queue · controls
packages/
  shared/                 Zod schemas, enums, scoring formula — used by both apps
  emails/                 Localised HTML email templates
docs/
  OPERATIONS.md           Cycle mechanics, email setup, privacy, production notes
  GOING_LIVE.md           Step-by-step checklist: testing setup -> real rollout
  SPEC.md                 The frozen original requirements spec (historical)
```

**Dependencies and prerequisites → [DEPENDENCIES.md](DEPENDENCIES.md)**

---

## Before a real launch

**Full step-by-step checklist → [docs/GOING_LIVE.md](docs/GOING_LIVE.md).**
Short version:

1. Set `ALLOWED_EMAIL_DOMAINS` (and `GOOGLE_HOSTED_DOMAIN`) to your
   organisation's domain(s) — until then, any Google account can sign in.
2. Verify your sending domain in Resend (SPF, DKIM, DMARC), add
   `RESEND_API_KEY`, set `MAIL_DRY_RUN=false`, and register the webhook at
   `POST /api/webhooks/resend`.
3. Replace `TEST_USERS` in `apps/api/prisma/seed.ts` with the real HR export,
   so division and department are right from first sign-in.
4. Move to migrations: `pnpm db:migrate`, then `db:deploy` on release.
5. Decide the rank-list visibility. `showMissesToStaff` defaults **off**.

   > Publishing named individual miss counts to all staff is a name-and-shame
   > mechanism. In Latvia and Lithuania it engages employment law and GDPR — you
   > need a documented lawful basis, and works-council consultation may apply.
   > Get HR and legal sign-off before enabling it.

6. Say plainly that anonymity is **pseudonymity**. `submitter_id` is always
   recorded; identity is stripped on output and any admin reveal writes an
   audit row. Staff finding this out later does more damage than never
   offering it.

---

## Known gaps

| Gap                    | Note                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Tests                  | No Playwright or Vitest suites yet — the app has been run and exercised by hand, not automatically                                       |
| Attachments            | Modelled and multer installed, but the upload route and UI aren't wired — object storage and the MIME allowlist are deployment decisions |
| LT and KA translations | Fall back to EN                                                                                                                          |
| ISO 9001 push          | `qms_action_ref` is free text; no automated hand-off                                                                                     |
| Domain restriction     | Off by default — any Google account can currently sign in. See "Before a real launch" above                                             |
