# Five-minute walkthrough

The order below builds the argument: a staff member's week, then what happens to
what they wrote, then the mechanism that drives both.

Sign in from the picker on the login screen — no password.

---

## 1. The staff week (2 min)

Sign in as **Juris Kalnins** · `nav.instructor@novikontas.org`

**My log** opens on the watch strip. That's the signature element: this week drawn
as seven day ticks, amber marking Friday's reminder, navy marking Sunday's
deadline. Either it says *Logged* with a reference code, or it's counting down.

- Point out the reference code (`SUG-2026-0142`) — staff quote it in conversation
- Scroll the log: statuses, week numbers, categories

Now **New suggestion**. Two things to demonstrate:

1. The anonymity toggle, and the hint under it. It says reviewers won't see the
   name, that the identity is still recorded, and that access is logged. That
   honesty is deliberate.
2. Submit one. Then go back to **New suggestion** — the quota blocks a second
   this week and offers a link to the first.

Withdraw it from the detail page and the week's slot reopens. This is why the
quota is a partial unique index rather than a plain one.

---

## 2. What happens to it (1 min)

Open any suggestion from a few weeks back — one marked **Implemented**.

- **Official response** has its own panel, because it's the point of the whole app
- **Status history** on the right: every transition, who made it, when, and the
  written reason. Append-only — this is the ISO 9001 trail
- Rejections carry reasons. That's enforced in the API, not just the UI

Then **Board**: everything colleagues have suggested, sorted by support. Anonymous
entries show as *Submitted anonymously*.

---

## 3. The rank list (1 min)

**Rank list** → *This quarter*.

Click **How the score works**. The formula is published in the app, not hidden:

```
implemented +10   accepted +5   on time +2   in grace +1   vote +0.5   missed −3
```

The point to make out loud: **volume can't win.** One accepted suggestion beats
two on-time submissions; one implemented beats five. That's what stops a weekly
quota from producing filler.

Your own row is highlighted, streaks over two weeks show a flame, and misses are
red. Sign in as **Agnese Liepina** to see the view from the bottom of the table —
missed weeks and an exemption for leave.

---

## 4. Admin control (1 min)

Sign in as **Ilze Ozola** · `admin@novikontas.org`

**Review queue** — oldest first, overdue dates in red. Try the *Unassigned* and
*Overdue* filters.

Open one. The admin panel sits inline under the suggestion:

- Only legal transitions are offered — the state machine is server-side
- The decision button stays disabled until a reason is typed, for Reject and Defer
- Assign it, set an ISO 9001 reference, write the response
- On an anonymous one, **Reveal submitter**. Confirm, and it writes an `audit_logs`
  row. It's the only read in the system that leaves a trace

**Controls** is the punchline for anyone worried about being locked in:

- Every toggle changes behaviour with no deployment — quota, board, voting,
  anonymity, and the three rank-list visibility settings
- Reminder hours are editable
- **Run now** fires the Friday reminder, Monday reminder, or cycle open/close on
  demand. With dry-run on, the rendered email prints to the API console — so you
  can show the reminder without waiting for Friday
- The cycles table shows on-time / in-grace / missed / pending per week

---

## Three things worth saying out loud

**The reminder carries proof, not just a nudge.** It leads with a recently
implemented suggestion and a running count. "Please submit a suggestion" gets
muted by week three.

**`showMissesToStaff` is on in this demo and off by default in the code.**
Publishing named miss counts to all staff engages employment law and GDPR in
Latvia and Lithuania. It's one toggle, and it should follow HR and legal sign-off.

**Anonymity is pseudonymity, and the app says so.** The alternative — discarding
the identity — means no recourse if the box gets abused. The compromise is that
every reveal is audited.

---

## Reset

```bash
pnpm demo:reseed      # local
```

On Render, redeploy with `RESEED=true` set on the service, then remove it.
