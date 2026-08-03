# Staff Suggestion Platform — Development Spec v1

**Organisation:** Novikontas Jūras koledža
**Status:** Requirements frozen — ready for build
**Date:** 2026-08-03

---

## 1. Purpose

An internal web application through which permanent staff submit improvement
suggestions, and administrators review, respond to, and track them through to
implementation.

The application's job is not to collect suggestions. It is to make the
organisation's *response* to suggestions visible. Every design decision below
follows from that: status timelines are public to the submitter, rejections
require a written reason, and the weekly reminder email leads with what has
already been implemented.

**Context that shapes the design**

- ~100 permanent employees across Latvia, Lithuania and Georgia
- Multilingual workforce — the UI and all email must be localised
- ISO 9001 quality management system already in place; accepted suggestions
  must be able to become QMS improvement actions
- EU-based organisation — GDPR applies to all employee data

---

## 2. Users and roles

| Role | Who | Capabilities |
|---|---|---|
| `STAFF` | Permanent employees with an org mailbox | Submit, view own suggestions, view the public board, upvote, comment, withdraw own draft |
| `ADMIN` | Suggestion owner + division heads | Everything STAFF can do, plus review queue, status changes, official responses, internal comments, category management, analytics |

**Explicitly out of scope for v1:** freelance instructors and any external
party. Access is limited to holders of an allowlisted organisational email
address. No separate `REVIEWER` role in v1 — admins review. The role enum is
designed so a `REVIEWER` tier can be inserted later without a data migration.

---

## 3. Process and governance

This must be agreed and communicated **before** launch, not after.

**Lifecycle**

```
SUBMITTED → UNDER_REVIEW → ACCEPTED  → IMPLEMENTED
                         → REJECTED
                         → DEFERRED
```

**Rules**

- A named owner is accountable for the review queue — a person, not a department
- Acknowledgement (move out of `SUBMITTED`) within **3 working days**
- Decision (`ACCEPTED` / `REJECTED` / `DEFERRED`) within **20 working days**
- `REJECTED` and `DEFERRED` require a written reason. Enforced at API level,
  not just in the UI
- `ACCEPTED` prompts the admin to record a QMS action reference
- Every status transition is written to an immutable history table

**Launch condition:** do not open the app with an empty board. Seed it with
3–5 real suggestions that already have official responses.

---

## 4. Scope

**In scope (v1, staff side first)**

1. Passwordless login via org email
2. Submit a suggestion — category, title, body, optional attachment,
   anonymity toggle
3. "My suggestions" list with current status
4. Suggestion detail — status timeline, official response, comments
5. Edit or withdraw, permitted only while status is `SUBMITTED`
6. Public board — all non-anonymous suggestions, read-only, upvotable
7. Email notifications on status change
8. Weekly reminder email
9. Locale switching (EN / LV / LT / RU / KA)

**In scope (v1, admin side — built after staff side)**

10. Review queue with filters by status, category, division, age
11. Status transitions with mandatory reason capture
12. Official response composition
13. Internal comments, invisible to staff
14. Category management
15. Dashboard: volume, SLA compliance, implementation rate

**Deferred to v2+**

- Rewards / gamification
- SSO integration
- File-heavy attachments, multiple per suggestion
- Freelancer access
- Automated push into the QMS system

---

## 5. Stack (final)

**Frontend**

| Concern | Choice |
|---|---|
| Framework | React 19 + Vite, TypeScript |
| Styling | Tailwind CSS v4 |
| Routing | React Router |
| Server state | TanStack Query |
| Forms + validation | React Hook Form + Zod |
| i18n | react-i18next |
| Icons | lucide-react |

**Backend**

| Concern | Choice |
|---|---|
| Runtime | Node 22 + Express, TypeScript |
| ORM / migrations | Prisma |
| Database | PostgreSQL 16 |
| Validation | Zod, schemas shared with frontend |
| Sessions | httpOnly, secure, SameSite=Lax cookie; 30-day rolling |
| Email | Resend + react-email templates |
| Job scheduling | pg-boss (Postgres-backed) |
| Security | helmet, express-rate-limit, cors allowlist |
| Logging | pino, structured JSON |
| File storage | S3-compatible, EU region (local volume for pilot) |

**Repo layout — pnpm monorepo**

```
apps/
  web/          React + Vite + Tailwind
  api/          Express + Prisma
packages/
  shared/       Zod schemas, TS types, status enums, constants
  emails/       react-email templates, one per locale
prisma/
  schema.prisma
  migrations/
docker-compose.yml
```

Sharing Zod schemas through `packages/shared` means a validation rule is
written once and enforced on both sides.

---

## 6. Data model

Full Prisma schema in `schema.prisma`. Design notes:

- **`submitter_id` is non-nullable, `is_anonymous` is a boolean.** The
  submitter is always recorded; anonymity is enforced at the serialisation
  layer, which strips submitter fields before the response leaves the API.
  This preserves traceability for abuse cases while keeping the identity
  invisible to reviewers. Access to the underlying identity must be logged.
- **`reference_code`** — human-readable, e.g. `SUG-2026-0142`. Gives staff
  something to quote in conversation and lets them track an item.
- **`status_history`** is append-only. No updates, no deletes. This is the
  ISO audit trail.
- **`search_vector`** is a generated `tsvector` column. Prisma cannot express
  it natively — declare it as `Unsupported("tsvector")` and create it in a
  hand-written migration with a GIN index.
- **`email_log`** is populated by Resend webhooks. Without it you cannot
  distinguish low engagement from mail landing in Junk.
- No `employee_type` column — v1 has permanent staff only.

---

## 7. Authentication

Passwordless magic link, restricted by email domain.

```
1. User submits email
2. API checks domain against ALLOWED_EMAIL_DOMAINS config
3. Generate 32 bytes of CSPRNG randomness → the link token
4. Store SHA-256(token) with 15-minute expiry, single use
5. Resend delivers the link in the user's locale
6. Click → hash and compare, mark consumed, issue session cookie
7. No users row? Create one with role STAFF on first successful login
```

**Hardening**

- Rate limit: 3 link requests per email per 15 min, 10 per IP per hour
- Always return the same generic response whether or not the address exists
- Log every attempt with IP and user agent
- Invalidate all outstanding tokens for an email on successful consumption
- Session regeneration on login

**Seeding:** import the ~100 permanent staff from HR data so division,
department and locale are correct from day one. Self-registration then only
covers gaps rather than being the primary path.

---

## 8. Email and reminders

**Prerequisite:** verify the sending domain — SPF, DKIM and DMARC — before
launch. Internal mail to your own domain still gets filtered without it.

**Templates** (react-email, one per locale, shared branded layout using
`NoAca_logo_drkblue.svg`)

| Template | Trigger |
|---|---|
| `login-link` | Login requested |
| `status-changed` | Suggestion status transition |
| `response-posted` | Official response published |
| `weekly-reminder` | Scheduled job |

**Webhooks:** subscribe to `delivered`, `bounced`, `complained`. Write to
`email_log`. Auto-set `reminders_enabled = false` after repeated hard bounces.

**Weekly reminder job** — pg-boss cron, Monday 09:00 Riga time:

```
for each user where is_active:
  skip if notification_prefs.reminders_enabled = false
  skip if user submitted a suggestion in the last 21 days
  skip if previously hard-bounced
  queue send in user's locale
write summary row to reminder_runs
```

Batch the sends in chunks with a short delay between requests to stay inside
the Resend account rate limit.

**Content rule:** the reminder must carry value, not just a nudge. Lead with
one recently implemented suggestion and a running count — "14 suggestions
implemented this year" — then the call to action. Include a one-click opt-out
link that works without logging in, via a signed unsubscribe token.

---

## 9. Staff-side screens

| Screen | Route | Notes |
|---|---|---|
| Login | `/login` | Email field, locale switcher, domain error state |
| Link sent | `/login/sent` | "Check your inbox", resend after 60s |
| Submit | `/suggestions/new` | Category select, title, body, attachment, anonymity toggle, character counters |
| My suggestions | `/suggestions/mine` | Status chips, sort by date/status, empty state that prompts first submission |
| Detail | `/suggestions/:code` | Status timeline, official response, comment thread, withdraw/edit while `SUBMITTED` |
| Board | `/board` | Card grid, filter by category/division, upvote, search |
| Preferences | `/settings` | Locale, reminder opt-out |

Wireframe the submit form, my-suggestions list and detail view before any
styling work. Those three carry most of the product.

---

## 10. API surface (staff side)

```
POST   /api/auth/request-link      { email }
GET    /api/auth/verify?token=
POST   /api/auth/logout
GET    /api/me

GET    /api/categories

POST   /api/suggestions            create
GET    /api/suggestions/mine
GET    /api/suggestions/board      paginated, filterable, searchable
GET    /api/suggestions/:code
PATCH  /api/suggestions/:code      only while SUBMITTED, own only
DELETE /api/suggestions/:code      soft withdraw, only while SUBMITTED

POST   /api/suggestions/:code/vote
DELETE /api/suggestions/:code/vote
POST   /api/suggestions/:code/comments

PATCH  /api/me/preferences
GET    /api/unsubscribe?token=     no session required

POST   /api/webhooks/resend        signature-verified
```

All list endpoints are cursor-paginated. All responses pass through a
serialiser that strips submitter identity when `is_anonymous` is true and
strips `is_internal` comments for non-admins.

---

## 11. Non-functional requirements

**GDPR**

- Lawful basis: legitimate interest (internal improvement process). Document it
- Publish an internal privacy notice explaining what is stored, for how long,
  and who can see it — including the fact that anonymous submissions are
  pseudonymous, not truly anonymous
- Retention: suggestions and history retained 3 years after closure, then
  anonymised rather than deleted, to preserve reporting continuity
- `auth_tokens` purged 24 hours after expiry
- Data subject access: an admin export of all rows relating to one user
- All infrastructure and object storage hosted in the EU

**Security**

- Input validation on every endpoint via shared Zod schemas
- Attachment handling: allowlist MIME types, cap size, scan or sandbox,
  never serve from the app origin
- CSRF protection on all state-changing requests
- Audit log for any admin action that reveals an anonymous submitter

**Accessibility and i18n**

- WCAG 2.1 AA: keyboard navigable, visible focus states, labelled form fields,
  4.5:1 contrast minimum
- No text hardcoded in components; all strings from i18n resource files
- Category names stored as JSONB keyed by locale

**Performance** — modest scale (~100 users), so no caching layer needed. GIN
index on `search_vector`, btree indexes on `status`, `category_id`,
`submitter_id`, `created_at`.

---

## 12. Build order

Each milestone ends deployable and demonstrable.

| # | Milestone | Contents |
|---|---|---|
| 0 | Foundation | pnpm monorepo, Docker Compose, Prisma schema, migrations, seed script, CI |
| 1 | Auth | Magic link end to end, session cookie, `/api/me`, login screens, Resend domain verified |
| 2 | Submit | Categories, submit form, validation, attachment upload, reference code generation |
| 3 | Read | My suggestions list, detail view, status timeline |
| 4 | Self-service | Edit and withdraw while `SUBMITTED` |
| 5 | Notifications | Status-change and response emails, webhook ingestion, email log |
| 6 | Reminders | pg-boss cron, skip logic, unsubscribe flow, reminder runs |
| 7 | Board | Public board, voting, comments, search |
| 8 | Localisation | Full EN/LV/LT/RU/KA pass, translation review |
| 9 | Hardening | Rate limits, a11y audit, Playwright E2E, load sanity check |
| 10 | Admin side | Review queue, transitions, responses, dashboard *(separate phase)* |

Then: pilot with one department for 2–3 weeks before organisation-wide rollout.

---

## 13. Success metrics

Reviewed quarterly. The first two are the real ones — the rest are diagnostic.

| Metric | Target |
|---|---|
| % of suggestions answered within SLA | > 90% |
| % of suggestions implemented | > 15% |
| Submissions per month | Baseline in month 1, then track trend |
| Unique submitters per quarter | > 25% of staff |
| Repeat submitters | > 40% of submitters |
| Reminder email delivery rate | > 98% |
| Reminder opt-out rate | < 10% |

A high submission rate with a low implementation rate is worse than no app at
all — it manufactures visible evidence that suggestions go nowhere.

---

## 14. Decisions log

| Decision | Choice | Rationale |
|---|---|---|
| Database | PostgreSQL | Relational audit trail, native FTS, SQL reporting for ISO |
| ORM | Prisma | Typed client, reviewable migration history |
| Identity | Org email, passwordless | No password storage, domain acts as access control |
| Anonymity | Submitter's choice per suggestion | Encourages sensitive submissions; identity retained internally |
| Roles | STAFF, ADMIN only | Freelancers and externals excluded from v1 |
| Board visibility | All staff, read-only, upvotable | Visible responses drive adoption |
| Reminder cadence | Weekly, skipping submitters from the last 21 days | Avoids nudging people who just contributed |
| Scheduler | pg-boss | Postgres-backed, no Redis, survives restarts |
| Build order | Staff side before admin side | Validates the submission path first |

---

## 15. Open items

1. Name the accountable suggestion owner
2. Confirm the exact allowlisted email domain(s)
3. Confirm the initial category list — by division, by theme, or both
4. Confirm whether Georgian (KA) is needed in v1
5. Confirm hosting target and object storage provider
6. Confirm how an `ACCEPTED` suggestion is recorded in the ISO 9001 system
7. Legal/HR sign-off on the privacy notice and retention period
