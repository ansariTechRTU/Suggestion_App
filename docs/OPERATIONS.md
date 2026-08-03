# Operations manual

Depth behind the summary in [../README.md](../README.md): how the weekly cycle
runs, how the rank list scores, what to configure in Resend, and what to settle
with HR and legal before rollout.

---

## How the week works

```
Mon 00:05   cycle.open        this week's cycle + a PENDING row per active user
  …         staff submit      one suggestion fills the week's slot
Fri 17:00   reminder.friday   email everyone still PENDING
Sun 23:59   on-time deadline
Mon 09:00   reminder.monday   final call to anyone who missed last week
Mon 12:00   cycle.close       remaining PENDING rows become MISSED
```

- Submitting between Monday 00:00 and noon fills **last week's** slot first if it
  is empty — that is what the Monday reminder is for. It is recorded as
  `SUBMITTED_IN_GRACE` and scores 1 instead of 2.
- Withdrawing a suggestion reverts the week to `PENDING`, so the slot reopens.
- An admin can set any week to `EXEMPT` for a person — leave and sick weeks must
  not count as misses.
- Every hour and every toggle is an admin setting, editable in **Admin →
  Controls**. Changing a reminder hour takes effect at the next API restart.

### Rehearsing it

Do not wait a week to find out whether the emails read well. In
**Admin → Controls → Run now**, trigger `reminder.friday`, `reminder.monday`,
`cycle.open` and `cycle.close` on demand. With dry-run on, the rendered mail
lands in the API console.

---

## The rank list

Score, published in the UI so nobody has to guess:

```
implemented   +10      submitted on time   +2
accepted       +5      submitted in grace  +1
vote received  +0.5    missed week         -3
```

Deliberate: one accepted suggestion outweighs two on-time submissions, and one
implemented outweighs five. A weekly quota rewards turning up, but turning up
cannot out-score being useful. Without that weighting, a quota reliably produces
filler logged at 16:55 on Friday.

Three admin settings govern who sees what:

| Setting | Effect |
|---|---|
| `leaderboard.visibleToStaff` | Off → administrators only |
| `leaderboard.showNamesToStaff` | Off → colleagues appear as "Colleague" |
| `leaderboard.showMissesToStaff` | Off → miss counts are admin-only |

**Recommended launch position:** names visible, misses admin-only.

> Publishing named individual miss counts to all staff is a name-and-shame
> mechanism. In Latvia and Lithuania it engages employment law and GDPR — you
> need a documented lawful basis, and works-council consultation may apply. Take
> HR and legal sign-off before switching `showMissesToStaff` on.

---

## Email

Set up before launch, in this order:

1. Add and **verify your sending domain** in Resend — SPF, DKIM and DMARC.
   Internal mail to your own domain still gets filtered without it.
2. Put the API key in `RESEND_API_KEY` and set `MAIL_DRY_RUN=false`.
3. Add a webhook pointing at `POST /api/webhooks/resend` for `email.delivered`,
   `email.bounced`, `email.opened` and `email.complained`. Put the signing secret
   in `RESEND_WEBHOOK_SECRET`.

Every send is recorded in `email_log` before it leaves. Without that table you
cannot tell "nobody cares" from "everything is in Junk" — which is the single
most common reason an internal tool looks dead.

Templates live in `packages/emails`. Plain HTML, not react-email: no JSX build in
the API process and no render dependency at runtime. EN, LV and RU are written;
LT and KA fall back to EN until translations are supplied.

---

## Privacy and anonymity — read before launch

Anonymity here is **pseudonymity**, and the interface says so. `submitter_id` is
always recorded; identity is stripped on the way out by
`apps/api/src/services/serializers.ts`. An admin can reveal a submitter through
`POST /api/admin/suggestions/:code/reveal`, which writes an `audit_logs` row.

State this plainly in the internal privacy notice. Staff discovering later that
"anonymous" was not anonymous does more damage than never offering the option.

Also settle before rollout: lawful basis (legitimate interest, documented),
retention (suggestions and history 3 years after closure, then anonymised),
and EU-only hosting.

---

## Production notes

- Set `NODE_ENV=production`, `MAIL_DRY_RUN=false`, real secrets, and a
  `DATABASE_URL` pointing at the production Supabase project, not a dev one
- Serve web and API on the same site so the session cookie stays first-party
- `secure: true` on the cookie is automatic once `NODE_ENV=production` — the app
  must be behind HTTPS
- Run **one** API instance, or move the scheduler to its own process: pg-boss
  will happily run on several, but the reminder job is written to run once per
  slot
- `pnpm --filter api db:deploy` applies migrations without prompting
- Back up Postgres. `status_history` and `audit_logs` are the ISO 9001 record and
  are append-only by design

## Not built yet

Attachments are modelled (`suggestion_attachments`, multer is installed) but the
upload route and UI are not wired — deliberately, since object storage and the
MIME allowlist are a deployment decision. Also open: LT and KA translations,
Playwright end-to-end tests, and the automated push of an accepted suggestion
into the ISO 9001 system (`qms_action_ref` is a free-text field for now).
