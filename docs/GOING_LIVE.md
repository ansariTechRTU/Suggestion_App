# Going live — checklist

Testing setup → real rollout. Work top to bottom.

---

## 1. Google Sign-In

- [ ] **Set domain allowlist** — `.env` (local) + Render → Environment:
      ```
      ALLOWED_EMAIL_DOMAINS=yourdomain.com
      GOOGLE_HOSTED_DOMAIN=yourdomain.com
      ```
- [ ] **Add the production redirect URI** — Google Cloud Console → APIs & Services →
      Credentials → your OAuth client → Authorized redirect URIs → **+ Add URI**:
      ```
      https://YOUR-RENDER-URL/api/auth/google/callback
      ```
      Must be the **full path**, not just the domain — `https://x.onrender.com` alone
      will fail with `redirect_uri_mismatch` even though it looks close enough.
      Exact match required: scheme, host, path, no trailing slash. Takes a few
      minutes to propagate.
- [ ] **Move consent screen out of Testing** — OAuth consent screen page:
      - Internal (Workspace): nothing to do, no cap, no publish step.
      - External: either add every real user under **Test users** (cap 100), or
        click **Publish App**. `openid`/`email`/`profile` scopes don't normally
        need Google's verification review.

---

## 2. Real users, not test data

- [ ] Replace `TEST_USERS` in `apps/api/prisma/seed.ts` with the real roster
      (email, name, division, department, role) from HR.
- [ ] `pnpm db:seed` — upserts only, safe anytime.
      `pnpm db:reseed` instead **only** if old test data needs wiping first —
      it deletes every suggestion/cycle/vote/comment and any user not in
      `TEST_USERS`. Never run it once real data exists.

---

## 3. Database

- [ ] Move off `db push` onto migrations:
      ```bash
      pnpm db:migrate     # creates migration, folds in raw.sql
      ```
      Then switch `release` (`apps/api/package.json`) and Render's
      `startCommand` from `db push` to `pnpm --filter api db:deploy`.
- [ ] Confirm Supabase plan has backups / point-in-time recovery if needed —
      free tier pauses after a week idle.

---

## 4. Email — Resend

- [ ] Sign up at [resend.com](https://resend.com), **add your sending domain**,
      add the SPF/DKIM/DMARC records it gives you to your domain's DNS.
- [ ] Once verified, generate an API key.
- [ ] Render → Environment: `RESEND_API_KEY=<key>`, `MAIL_DRY_RUN=false`.
- [ ] Resend dashboard → Webhooks → add `https://YOUR-RENDER-URL/api/webhooks/resend`,
      subscribe to `email.delivered` / `bounced` / `opened` / `complained` →
      paste its signing secret into `RESEND_WEBHOOK_SECRET`.

Until this is done, leaving both blank is fine — `MAIL_DRY_RUN=true` just logs
mail instead of sending, nothing breaks.

---

## 5. Secrets

- [ ] Fresh `SESSION_SECRET` / `UNSUBSCRIBE_SECRET` for production (`openssl
      rand -hex 32` each) — don't reuse local `demo_only_...` values. Render's
      blueprint already auto-generates these (`generateValue: true`).
- [ ] `NODE_ENV=production` set (flips cookies to `secure: true` — app must be
      HTTPS from this point).
- [ ] `.env` confirmed git-ignored, no real secret ever committed.

---

## 6. Rank list — needs a decision, not just a toggle

- [ ] Set in **Admin → Controls**: `leaderboard.visibleToStaff`,
      `showNamesToStaff`, `showMissesToStaff`. Recommended: names on, misses
      admin-only.
- [ ] **Get HR/legal sign-off before enabling `showMissesToStaff`** — publishing
      named miss counts is a name-and-shame mechanism; in LV/LT it engages
      employment law and GDPR, may need works-council consultation.
- [ ] State plainly in your internal notice: this is **pseudonymity**, not
      anonymity. `submitter_id` is always recorded; reveal is audit-logged.

---

## 7. Deploy (Render)

- [ ] Push to GitHub → Render → **New → Blueprint** → select repo → Apply.
- [ ] Fill in (Environment tab, all `sync: false` in `render.yaml`):
      `DATABASE_URL`, `DIRECT_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
      `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`.
- [ ] Confirm `/api/health` goes green.
- [ ] Free plan sleeps after inactivity (~30s cold start) — upgrade if that
      matters.
- [ ] Run **one** API instance only, or move the scheduler out — pg-boss's
      reminder jobs assume a single runner per slot.

---

## 8. Smoke test before announcing it

- [ ] Sign in with a real non-admin account end-to-end.
- [ ] **Admin → Controls → Run now**: trigger `cycle.open`, `reminder.friday`,
      `reminder.monday`, `cycle.close` once each, check the emails.
- [ ] Submit → review → accept/reject → respond, one suggestion, full loop.

---

## Known gaps

| Gap | Note |
|---|---|
| Tests | None yet — exercised by hand |
| Attachments | Modelled, route/UI not wired |
| LT / KA | Fall back to EN |
| ISO 9001 push | `qms_action_ref` is free text, manual |

More depth: [OPERATIONS.md](OPERATIONS.md) · commands: [README.md](../README.md)
