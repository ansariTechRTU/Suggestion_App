# Going live — from testing to real use

Everything to change, and exactly where, to move this app from its current
testing setup (any Google account can sign in, placeholder test users, dry-run
email) to a real rollout. Work through it top to bottom — later steps assume
earlier ones are done.

---

## 1. Lock Google sign-in down to your organisation

Right now `ALLOWED_EMAIL_DOMAINS` is blank, so **any** Google account can sign
in. That's fine for testing, not for launch.

- [ ] **Set the domain allowlist.** In `.env` (local) and in the Render
      service's environment tab (production):
      ```
      ALLOWED_EMAIL_DOMAINS=yourdomain.com
      GOOGLE_HOSTED_DOMAIN=yourdomain.com
      ```
      Comma-separate multiple domains if you have more than one. Once set,
      `apps/api/src/routes/google.ts` starts rejecting every account outside
      those domains, checked against the verified `hd` claim — not just the
      cosmetic hint sent to Google's account chooser.

- [ ] **Move the OAuth consent screen out of Testing.** In
      [console.cloud.google.com](https://console.cloud.google.com) → your
      project → APIs & Services → OAuth consent screen:
      - If you're on Google Workspace and chose **Internal**: nothing to do —
        internal apps have no testing cap and no publishing step.
      - If you chose **External**: it's capped at 100 named "test users"
        while in Testing status. Either add every real user's email under
        **Test users**, or click **Publish App** to open it to your whole
        domain. For the `openid`/`email`/`profile` scopes this app uses
        (non-sensitive), publishing normally does not require Google's
        verification review — check the console for any warning specific to
        your setup before assuming that.

- [ ] **Add the production redirect URI** to the same OAuth client once you
      know your real domain:
      `https://YOUR-DOMAIN/api/auth/google/callback` — exact match, Google
      compares it character for character.

---

## 2. Replace the test users with the real roster

- [ ] Open `apps/api/prisma/seed.ts` and replace the `TEST_USERS` array
      (currently your admin account plus two `@example.com` placeholders) with
      the real staff list — email, full name, division, department, role —
      from an HR export.
- [ ] Run the seed against production:
      ```bash
      pnpm db:seed       # upserts only, safe to run anytime
      ```
      If old test/placeholder rows are already in the production database and
      need clearing first, use `pnpm db:reseed` instead — **this deletes every
      suggestion, cycle, vote, comment and any user not in `TEST_USERS`**, so
      only run it before real data exists, never after.

---

## 3. Database — move off `db push`, onto migrations

`db push` (what `pnpm setup` and the Render release step use today) is fine
pre-launch because it needs no migration history. For production:

- [ ] Generate a baseline migration and fold `raw.sql` into it:
      ```bash
      pnpm db:migrate        # creates the migration, runs append-raw.mjs
      ```
- [ ] Switch the release command (`apps/api/package.json` → `release` script,
      and `render.yaml` → `startCommand`) from `db push` to
      `pnpm --filter api db:deploy` (applies migrations without prompting).
- [ ] Confirm your Supabase project is on a tier where automated backups /
      point-in-time recovery are enabled if you need them — the free tier
      pauses after a week of inactivity, which is fine for testing, not for a
      live system people depend on.

---

## 4. Real email — Resend

Currently `MAIL_DRY_RUN=true` prints every email to the API console instead of
sending it.

- [ ] Verify your sending domain in Resend (SPF, DKIM, DMARC). Without this,
      even mail to your own domain gets filtered.
- [ ] Set `RESEND_API_KEY` and `MAIL_DRY_RUN=false` (`.env` locally, Render
      environment tab in production).
- [ ] Add a Resend webhook pointing at `POST /api/webhooks/resend`, subscribed
      to `email.delivered`, `email.bounced`, `email.opened`, `email.complained`.
      Put its signing secret in `RESEND_WEBHOOK_SECRET`. Every send is recorded
      in `email_log` — without the webhook you can't tell "nobody's reading
      these" from "they're all landing in Junk."

---

## 5. Secrets and environment hygiene

- [ ] Generate fresh `SESSION_SECRET` and `UNSUBSCRIBE_SECRET` for production
      — don't carry over the `demo_only_...` placeholder values from local
      dev. `openssl rand -hex 32` for each. (If deploying via `render.yaml`'s
      Blueprint, this is already handled — `generateValue: true` creates them
      automatically on first deploy.)
- [ ] Set `NODE_ENV=production` — this also flips the session cookie to
      `secure: true`, so the app must be served over HTTPS from this point on.
- [ ] Double-check `.env` is git-ignored and no real secret ever got committed
      while testing.

---

## 6. Rank list visibility — needs a decision, not just a toggle

- [ ] Decide the three settings in **Admin → Controls**:
      `leaderboard.visibleToStaff`, `leaderboard.showNamesToStaff`,
      `leaderboard.showMissesToStaff`. Recommended launch position: names
      visible, misses admin-only.
- [ ] **Get HR and legal sign-off before turning `showMissesToStaff` on.**
      Publishing named individual miss counts to all staff is a
      name-and-shame mechanism; in Latvia and Lithuania it engages employment
      law and GDPR and may need works-council consultation.
- [ ] State plainly, in whatever internal notice introduces this tool, that
      anonymity here is **pseudonymity** — `submitter_id` is always recorded,
      identity is stripped only on output, and any admin reveal
      (`POST /api/admin/suggestions/:code/reveal`) writes an audit-log row.
      Staff discovering this later does more damage than never having
      offered anonymity at all.

---

## 7. Deploy

- [ ] Push to GitHub, then in Render: **New → Blueprint → select the repo →
      Apply**.
- [ ] Fill in, in the service's Environment tab (all marked `sync: false` in
      `render.yaml`, so Render won't silently overwrite them):
      `DATABASE_URL`, `DIRECT_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
      `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`.
- [ ] Confirm the health check at `/api/health` goes green.
- [ ] If staying on Render's free plan: know that the service sleeps after
      inactivity (first request after a pause takes ~30s). Upgrade if that's
      not acceptable for real use.
- [ ] Run **exactly one** API instance, or move the scheduler to its own
      process. pg-boss is fine running on several instances, but the
      Friday/Monday reminder jobs are written to fire once per slot.

---

## 8. Final smoke test before telling people it's live

- [ ] Sign in with a real (non-admin) account end-to-end.
- [ ] In **Admin → Controls → Run now**, manually trigger `cycle.open`,
      `reminder.friday`, `reminder.monday`, `cycle.close` once each and check
      the resulting emails render correctly.
- [ ] Submit, review, accept/reject, and respond to one real suggestion
      through its full lifecycle.

---

## Known gaps — not blockers, but worth flagging internally

| Gap | Note |
| --- | --- |
| Automated tests | None yet — the app is exercised by hand |
| Attachments | Modelled in the schema, route/UI not wired up |
| LT and KA translations | Fall back to EN |
| ISO 9001 push | `qms_action_ref` is free text, no automated hand-off |

See [OPERATIONS.md](OPERATIONS.md) for the deeper mechanics behind the weekly
cycle and scoring, and the main [README.md](../README.md) for day-to-day
commands.
