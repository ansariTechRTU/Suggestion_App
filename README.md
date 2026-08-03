# Novikontas Staff Suggestion Platform — Demo Build

An internal web app where staff log **one suggestion per week**, and every
suggestion gets an answer. Reminder Friday evening, a second chance Monday
morning, and a rank list scored on what actually gets accepted.

**This build is configured as a demo.** No passwords, no email account, no API
keys. It ships with 24 staff, 11 weeks of history and 172 suggestions already in
place, and you sign in by clicking a name.

**Stack:** PostgreSQL · Express · React · Node (PERN) — Prisma, Tailwind v4,
Resend, pg-boss, in a pnpm monorepo, TypeScript throughout.

---

## Deploy to Render from GitHub

```bash
git init && git add -A && git commit -m "Suggestion platform demo"
git remote add origin git@github.com:<you>/<repo>.git
git push -u origin main
```

Then in Render: **New → Blueprint → select the repo → Apply.**

`render.yaml` creates everything — a free PostgreSQL instance in Frankfurt and one
web service — and generates the session secrets itself. Nothing to configure by
hand.

First boot takes a few minutes: install, build the frontend, push the schema,
apply `raw.sql`, then seed the demo data. When the health check at `/api/health`
goes green, open the service URL and click a name to sign in.

**One service, not two.** Express serves the built React app, so there is a single
origin, the session cookie stays first-party, and there is no CORS to tune.

> **Free plan note:** the service sleeps after inactivity, so the first request
> after a pause takes ~30 seconds. Render's free Postgres also expires after 30
> days — fine for a demo, not for anything real.

### The one thing you must change for real use

```
DEMO_MODE=false
```

With it on, **anyone who can reach the URL can sign in as an administrator.**
That is the point during a demo and unacceptable afterwards. Turning it off
restores the real flow: a magic link to an allowlisted org email address.

---

## Run it locally

**Prerequisites:** Node 22+, pnpm 9+, Docker Desktop, Git.

```bash
npm install -g pnpm

cp .env.demo .env      # PowerShell: Copy-Item .env.demo .env
pnpm demo
```

That is the whole setup. `pnpm demo` installs every dependency across all four
packages, starts PostgreSQL, waits for it to accept connections, pushes the
schema, applies `raw.sql`, seeds the demo data, and starts both servers.

Then open <http://localhost:5173> and click a name to sign in.

To install and prepare the database _without_ starting the servers — useful the
first time, so you can read the output — run `pnpm setup` and then `pnpm dev`.

The steps `pnpm setup` runs, if you would rather do them one at a time:

```bash
pnpm install                    # all workspaces + prisma generate
pnpm db:up                      # PostgreSQL 16 in Docker on :5432
node scripts/wait-for-db.mjs    # poll until it is actually accepting connections
pnpm db:push                    # schema straight from schema.prisma
pnpm db:raw                     # tsvector column, quota index, vote trigger
pnpm demo:seed                  # 24 staff, 11 cycles, 172 suggestions
pnpm dev                        # API :4000 · web :5173
```

### Without Docker

Docker only supplies PostgreSQL. If you already run PostgreSQL 16 locally, point
`DATABASE_URL` in `.env` at it and skip `pnpm db:up`:

```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/suggestions?schema=public"
```

Then `pnpm install && pnpm db:push && pnpm db:raw && pnpm demo:seed && pnpm dev`.

### If something goes wrong

| Symptom                                            | Cause                                                                                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Invalid environment` on API start                 | No `.env` in the repository root — `cp .env.demo .env`                                                                                                                               |
| `timed out. Is Docker running?`                    | Docker Desktop is not started, or :5432 is taken by another PostgreSQL                                                                                                               |
| Port 5173 or 4000 already in use                   | Stop the other process, or change `PORT` in `.env`                                                                                                                                   |
| Sign-in link never arrives                         | Expected: `MAIL_DRY_RUN=true` prints it to the API console instead                                                                                                                   |
| `column "search_vector" ... is a generated column` | An older build could not re-run `db:push` after `db:raw`. Fixed: `db:push` now drops the generated column first and `db:raw` restores it. Always run the two together, in that order |

---

## Signing in

Three ways in, and which ones appear depends on configuration:

| Method               | When it shows                                         | Who it lets in                                                                               |
| -------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Google Workspace** | `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set | Verified Workspace accounts on an allowlisted domain                                         |
| **Magic link**       | Always                                                | Any allowlisted address; link is emailed, or printed to the console when `MAIL_DRY_RUN=true` |
| **Persona picker**   | `DEMO_MODE=true`                                      | Any seeded account, one click, no password                                                   |

### Setting up Google sign-in

Fifteen minutes in the Google Cloud Console, and the result is that only
@novikontas.org accounts can reach the app.

1. **Create a project** at <https://console.cloud.google.com> (or reuse one).
2. **APIs & Services → OAuth consent screen.** Choose **Internal** if the project
   sits inside the Novikontas Workspace — that alone stops anyone outside the
   organisation from even reaching the consent screen. Choose External only if
   you have no Workspace access, in which case the domain check below is doing
   all of the work.
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
   GOOGLE_HOSTED_DOMAIN=novikontas.org
   ALLOWED_EMAIL_DOMAINS=novikontas.org,novikontas.lv
   ```

5. **Restart the API.** The button appears on the login screen by itself.

**How the domain restriction actually works.** `GOOGLE_HOSTED_DOMAIN` is passed
to Google as the `hd` parameter, which filters the account chooser — but it is a
hint to the user interface, and a caller can edit it out of the URL. So it is
never trusted. On the way back, the API verifies the ID token's signature,
issuer and audience against Google's published keys, then requires all of:
the address is `email_verified`, the token carries an `hd` claim (personal
@gmail.com accounts do not), that claim matches the address domain, and the
domain is in `ALLOWED_EMAIL_DOMAINS`. A personal Gmail account fails at the
`hd` check, and an allowlisted address attached as an alias to a personal
account fails at the match.

Add a domain to `ALLOWED_EMAIL_DOMAINS` and it works for Google _and_ magic
links — one list governs both.

### Demo persona picker

The login screen lists everyone. Click a name — no password.

| Persona                                           | Sees                                                          |
| ------------------------------------------------- | ------------------------------------------------------------- |
| **Ilze Ozola** · admin@novikontas.org             | Everything: review queue, decisions, assignment, all settings |
| **Marek Vaitkus** · quality@novikontas.org        | Second administrator, Lithuanian locale                       |
| **Juris Kalnins** · nav.instructor@novikontas.org | Staff view, perfect submission record                         |
| **Agnese Liepina** · finance@novikontas.org       | Staff view with several missed weeks and an exemption         |

23 more staff are listed behind "Show all". The real magic-link form sits below
the picker and still works — in demo mode the link is printed to the API console
instead of being emailed.

**A five-minute walkthrough is in [docs/DEMO.md](docs/DEMO.md).**

---

## What's in the demo data

|               |                                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Staff         | 24 across College, Training Centre, Energy and Shared — 3 of them admins                                               |
| Weeks         | 11 ISO weeks: 10 closed, the current one open                                                                          |
| Suggestions   | 172 real maritime-training suggestions, spread across every status                                                     |
| Participation | On-time, in-grace, missed and exempt weeks, so the rank list has genuine spread                                        |
| Responses     | Every decided suggestion carries a written response; rejections carry reasons                                          |
| Extras        | Comments, internal admin notes, votes, assignment, due dates, overdue items, ISO 9001 references, reminder-run history |

Data is generated from a fixed seed, so every deploy looks identical. Re-seed with
`pnpm demo:reseed` (wipes and rebuilds).

---

## What it does

| Capability         | Detail                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Weekly quota       | One per person per ISO week. Enforced in the service layer, the participation ledger, and a partial unique index in Postgres                                              |
| Friday reminder    | 17:00 to anyone who hasn't logged one, skipping opt-outs and hard bounces                                                                                                 |
| Monday grace       | 09:00 final call; submitting before noon still fills last week's slot                                                                                                     |
| Miss ledger        | Monday noon, anything still pending becomes `MISSED`. Admins can mark a week `EXEMPT` for leave or sickness                                                               |
| Rank list          | Scored on accepted and implemented rather than volume. Visibility is admin-controlled                                                                                     |
| Full admin control | Review queue, status transitions with mandatory reasons, assignment with due dates, official responses, internal notes, categories, people, and every behavioural setting |
| Sign-in            | Passwordless magic link restricted to allowlisted org domains — or one-click personas in demo mode                                                                        |
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

## Commands

| Command                               | Does                                                                 |
| ------------------------------------- | -------------------------------------------------------------------- |
| `pnpm setup`                          | Everything but the servers: install, database, schema, raw SQL, seed |
| `pnpm demo`                           | `pnpm setup` followed by `pnpm dev`                                  |
| `pnpm dev`                            | API and web together, both hot-reloading                             |
| `pnpm dev:api` / `pnpm dev:web`       | One at a time                                                        |
| `pnpm demo:seed` / `pnpm demo:reseed` | Seed, or wipe and re-seed                                            |
| `pnpm db:up` / `pnpm db:down`         | Start / stop the Postgres container                                  |
| `pnpm db:push`                        | Apply `schema.prisma` directly — no migration files                  |
| `pnpm db:migrate`                     | Proper migration history, for real deployments                       |
| `pnpm db:raw`                         | Re-apply `raw.sql`                                                   |
| `pnpm db:studio`                      | Prisma Studio — a GUI over the data                                  |
| `pnpm typecheck`                      | All four packages                                                    |
| `pnpm build`                          | Production build of the frontend                                     |

`db:push` and `db:raw` are a pair and belong together, in that order: the push
drops the generated `search_vector` column — Prisma cannot describe a generated
column, so leaving it in place makes the second push fail — and `raw.sql`
recreates it with its GIN index. Nothing is lost; every value in it is derived
from title and body.

`db:push` is used for the demo because it needs no migration files. For a real
deployment switch to `pnpm db:migrate`, which writes migration history and folds
`raw.sql` into the migration so the next `migrate dev` doesn't see drift.

---

## Repository layout

```
render.yaml               Render blueprint — database + web service
.env.demo                 Working demo config; copy to .env
scripts/
  wait-for-db.mjs         Polls PostgreSQL until it accepts connections
apps/
  api/                    Express + Prisma
    scripts/
      prisma.mjs          Runs the Prisma CLI with the root .env loaded
    prisma/
      schema.prisma       Data model — 16 tables
      raw.sql             tsvector column, quota index, vote trigger
      apply-raw.ts        Applies raw.sql through Prisma (no psql needed)
      append-raw.mjs      Folds raw.sql into a migration, for real deployments
      seed-demo.ts        The demo dataset
      seed.ts             Minimal seed for a real rollout
    src/
      lib/time.ts         ISO week maths in Europe/Riga
      services/cycles.ts  Open, grace window, close, miss ledger
      services/ranking.ts Leaderboard aggregation and streaks
      jobs/index.ts       pg-boss schedules
      routes/             auth · google · suggestions · admin · webhooks · misc
      services/session.ts Session cookie, shared by all three sign-in paths
  web/                    React + Vite + Tailwind v4
    src/components/WatchStrip.tsx   The week, drawn
    src/pages/            login · submit · my log · detail · board · ranks · settings
    src/pages/admin/      review queue · controls
packages/
  shared/                 Zod schemas, enums, scoring formula — used by both apps
  emails/                 Localised HTML email templates
docs/
  DEMO.md                 Five-minute walkthrough
  OPERATIONS.md           Cycle mechanics, email setup, privacy, production notes
  SPEC.md                 The frozen requirements spec
```

**Dependencies and prerequisites → [DEPENDENCIES.md](DEPENDENCIES.md)**

---

## Turning the demo into a real deployment

1. `DEMO_MODE=false` — removes one-click sign-in. **Non-negotiable.** Set up
   Google sign-in first, so people have a way in that needs no email delivery.
2. Verify your sending domain in Resend (SPF, DKIM, DMARC), add
   `RESEND_API_KEY`, set `MAIL_DRY_RUN=false`, and register the webhook at
   `POST /api/webhooks/resend`. Internal mail to your own domain still gets
   filtered without domain verification.
3. Replace `apps/api/prisma/seed-demo.ts` with `seed.ts` and the real HR export,
   so division and department are right from first sign-in.
4. Move to migrations: `pnpm db:migrate`, then `db:deploy` on release.
5. Upgrade off Render's free plans — free Postgres expires after 30 days.
6. Decide the rank-list visibility. The demo has `showMissesToStaff` **on** so you
   can see the whole mechanism; the shipped default is **off**.

> Publishing named individual miss counts to all staff is a name-and-shame
> mechanism. In Latvia and Lithuania it engages employment law and GDPR — you need
> a documented lawful basis, and works-council consultation may apply. Get HR and
> legal sign-off before enabling it for real.

7. Say plainly that anonymity is **pseudonymity**. `submitter_id` is always
   recorded; identity is stripped on output and any admin reveal writes an audit
   row. Staff finding this out later does more damage than never offering it.

---

## Known gaps

| Gap                    | Note                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Tests                  | No Playwright or Vitest suites yet — the app has been run and exercised by hand, not automatically                                       |
| Attachments            | Modelled and multer installed, but the upload route and UI aren't wired — object storage and the MIME allowlist are deployment decisions |
| LT and KA translations | Fall back to EN                                                                                                                          |
| ISO 9001 push          | `qms_action_ref` is free text; no automated hand-off                                                                                     |
