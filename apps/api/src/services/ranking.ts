import { DateTime } from 'luxon';
import { rank, type RankedStaff, type StaffTally } from '@nk/shared';
import { prisma } from '../prisma.js';
import { now } from '../lib/time.js';

export type Period = 'all' | 'year' | 'quarter';

function since(period: Period): Date | undefined {
  const n = now();
  if (period === 'year') return n.startOf('year').toJSDate();
  if (period === 'quarter') return n.startOf('quarter').toJSDate();
  return undefined;
}

/**
 * Builds the rank list. Deliberately computed on demand: at ~100 staff the
 * aggregate is a few milliseconds, and a materialised table would just be a
 * second source of truth to keep in sync.
 */
export async function leaderboard(opts: {
  period: Period;
  division?: string;
}): Promise<RankedStaff[]> {
  const from = since(opts.period);

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      ...(opts.division ? { division: opts.division as never } : {}),
    },
    select: { id: true, fullName: true, division: true, department: true },
  });
  if (users.length === 0) return [];

  const userIds = users.map((u) => u.id);

  const [participations, suggestions] = await Promise.all([
    prisma.cycleParticipation.findMany({
      where: {
        userId: { in: userIds },
        cycle: { status: 'CLOSED', ...(from ? { startsAt: { gte: from } } : {}) },
      },
      select: { userId: true, status: true, cycle: { select: { startsAt: true } } },
      orderBy: { cycle: { startsAt: 'asc' } },
    }),
    prisma.suggestion.findMany({
      where: {
        submitterId: { in: userIds },
        ...(from ? { createdAt: { gte: from } } : {}),
      },
      select: { submitterId: true, status: true, voteCount: true },
    }),
  ]);

  const base = new Map<string, StaffTally>();
  for (const u of users) {
    base.set(u.id, {
      userId: u.id,
      fullName: u.fullName,
      division: u.division,
      department: u.department,
      submitted: 0,
      onTime: 0,
      inGrace: 0,
      missed: 0,
      exempt: 0,
      accepted: 0,
      implemented: 0,
      rejected: 0,
      votesReceived: 0,
      currentStreak: 0,
      longestStreak: 0,
    });
  }

  // Participation-derived counts, in chronological order so streaks are correct.
  const streaks = new Map<string, { current: number; longest: number }>();
  for (const p of participations) {
    const t = base.get(p.userId);
    if (!t) continue;
    const st = streaks.get(p.userId) ?? { current: 0, longest: 0 };

    if (p.status === 'SUBMITTED_ON_TIME') {
      t.onTime += 1;
      t.submitted += 1;
      st.current += 1;
    } else if (p.status === 'SUBMITTED_IN_GRACE') {
      t.inGrace += 1;
      t.submitted += 1;
      st.current += 1;
    } else if (p.status === 'MISSED') {
      t.missed += 1;
      st.current = 0;
    } else if (p.status === 'EXEMPT') {
      t.exempt += 1; // neither breaks nor extends a streak
    }
    st.longest = Math.max(st.longest, st.current);
    streaks.set(p.userId, st);
  }

  for (const s of suggestions) {
    const t = base.get(s.submitterId);
    if (!t) continue;
    if (s.status === 'ACCEPTED') t.accepted += 1;
    if (s.status === 'IMPLEMENTED') t.implemented += 1;
    if (s.status === 'REJECTED') t.rejected += 1;
    t.votesReceived += s.voteCount;
  }

  for (const [userId, st] of streaks) {
    const t = base.get(userId);
    if (t) {
      t.currentStreak = st.current;
      t.longestStreak = st.longest;
    }
  }

  return rank([...base.values()]);
}

/** The signed-in person's own row, always returned even when names are hidden. */
export async function myStanding(userId: string, period: Period) {
  const rows = await leaderboard({ period });
  const mine = rows.find((r) => r.userId === userId) ?? null;
  return { row: mine, total: rows.length };
}

/** Organisation-wide numbers for the admin dashboard and reminder emails. */
export async function orgStats() {
  const yearStart = DateTime.now().startOf('year').toJSDate();
  const [implementedThisYear, acceptedThisYear, openCount, overdueCount, highlight] =
    await Promise.all([
      prisma.suggestion.count({ where: { status: 'IMPLEMENTED', createdAt: { gte: yearStart } } }),
      prisma.suggestion.count({ where: { status: 'ACCEPTED', createdAt: { gte: yearStart } } }),
      prisma.suggestion.count({
        where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'DEFERRED'] } },
      }),
      prisma.suggestion.count({
        where: {
          status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
          dueDate: { lt: new Date() },
        },
      }),
      prisma.suggestion.findFirst({
        where: { status: 'IMPLEMENTED' },
        orderBy: { closedAt: 'desc' },
        select: { referenceCode: true, title: true },
      }),
    ]);
  return { implementedThisYear, acceptedThisYear, openCount, overdueCount, highlight };
}
