import { DateTime } from 'luxon';
import type { WeeklyCycle } from '@prisma/client';
import { prisma } from '../prisma.js';
import { cycleBoundsFor, cycleLabel, now, previousCycleBounds, zone } from '../lib/time.js';
import { getSettings } from './settings.js';
import { logger } from '../logger.js';

/**
 * Returns the current week's cycle, creating it (and a PENDING participation row
 * for every active user) if the scheduler has not already done so. Called on
 * demand as well as by the job, so a missed cron run cannot block submissions.
 */
export async function ensureCurrentCycle(): Promise<WeeklyCycle> {
  const s = await getSettings();
  const b = cycleBoundsFor(now(), s['cycle.graceEndHour']);

  const existing = await prisma.weeklyCycle.findUnique({
    where: { isoYear_isoWeek: { isoYear: b.isoYear, isoWeek: b.isoWeek } },
  });
  if (existing) return existing;

  const cycle = await prisma.weeklyCycle.create({
    data: {
      isoYear: b.isoYear,
      isoWeek: b.isoWeek,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      graceEndsAt: b.graceEndsAt,
      status: 'OPEN',
    },
  });
  await seedParticipations(cycle.id);
  logger.info({ cycle: cycleLabel(b.isoYear, b.isoWeek) }, 'cycle opened');
  return cycle;
}

/** One PENDING row per active user. Idempotent. */
export async function seedParticipations(cycleId: string): Promise<number> {
  const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } });
  const res = await prisma.cycleParticipation.createMany({
    data: users.map((u) => ({ cycleId, userId: u.id })),
    skipDuplicates: true,
  });
  return res.count;
}

export async function getPreviousCycle(): Promise<WeeklyCycle | null> {
  const s = await getSettings();
  const b = previousCycleBounds(s['cycle.graceEndHour']);
  return prisma.weeklyCycle.findUnique({
    where: { isoYear_isoWeek: { isoYear: b.isoYear, isoWeek: b.isoWeek } },
  });
}

export interface CycleView {
  id: string;
  label: string;
  isoYear: number;
  isoWeek: number;
  startsAt: Date;
  endsAt: Date;
  graceEndsAt: Date;
  status: string;
  /** Whether the previous cycle is still inside its Monday grace window. */
  graceOpen: boolean;
  graceCycle: { id: string; label: string; graceEndsAt: Date } | null;
  mySubmission: { referenceCode: string; title: string; status: string } | null;
  myStatus: string;
  quotaEnabled: boolean;
  quotaPerCycle: number;
}

/**
 * Everything the UI needs to render the watch strip: this week, whether last
 * week can still be rescued, and where the person stands in both.
 */
export async function cycleViewFor(userId: string): Promise<CycleView> {
  const s = await getSettings();
  const current = await ensureCurrentCycle();

  const prev = await getPreviousCycle();
  const graceOpen = !!prev && prev.status !== 'CLOSED' && now().toJSDate() < prev.graceEndsAt;

  const participation = await prisma.cycleParticipation.findUnique({
    where: { cycleId_userId: { cycleId: current.id, userId } },
    include: {
      suggestion: { select: { referenceCode: true, title: true, status: true } },
    },
  });

  return {
    id: current.id,
    label: cycleLabel(current.isoYear, current.isoWeek),
    isoYear: current.isoYear,
    isoWeek: current.isoWeek,
    startsAt: current.startsAt,
    endsAt: current.endsAt,
    graceEndsAt: current.graceEndsAt,
    status: current.status,
    graceOpen,
    graceCycle:
      graceOpen && prev
        ? {
            id: prev.id,
            label: cycleLabel(prev.isoYear, prev.isoWeek),
            graceEndsAt: prev.graceEndsAt,
          }
        : null,
    mySubmission: participation?.suggestion
      ? {
          referenceCode: participation.suggestion.referenceCode,
          title: participation.suggestion.title,
          status: participation.suggestion.status,
        }
      : null,
    myStatus: participation?.status ?? 'PENDING',
    quotaEnabled: s['quota.enabled'],
    quotaPerCycle: s['quota.perCycle'],
  };
}

/**
 * Which cycle a new submission counts toward.
 *
 * Normally the current week. But between Monday 00:00 and the grace deadline, a
 * person who missed last week is filling last week's slot first — that is the
 * whole point of the Monday reminder.
 */
export async function targetCycleFor(
  userId: string,
): Promise<{ cycle: WeeklyCycle; inGrace: boolean }> {
  const current = await ensureCurrentCycle();
  const prev = await getPreviousCycle();

  if (prev && prev.status !== 'CLOSED' && now().toJSDate() < prev.graceEndsAt) {
    const prevPart = await prisma.cycleParticipation.findUnique({
      where: { cycleId_userId: { cycleId: prev.id, userId } },
    });
    if (prevPart && prevPart.status === 'PENDING') {
      return { cycle: prev, inGrace: true };
    }
  }
  return { cycle: current, inGrace: false };
}

/**
 * Closes the previous cycle: every still-PENDING row becomes MISSED. Runs at the
 * grace deadline (Monday noon) and is safe to run twice.
 */
export async function closePreviousCycle(): Promise<{
  cycleId: string | null;
  missed: number;
}> {
  const prev = await getPreviousCycle();
  if (!prev || prev.status === 'CLOSED') return { cycleId: prev?.id ?? null, missed: 0 };
  if (now().toJSDate() < prev.graceEndsAt) return { cycleId: prev.id, missed: 0 };

  const missed = await prisma.cycleParticipation.updateMany({
    where: { cycleId: prev.id, status: 'PENDING' },
    data: { status: 'MISSED' },
  });
  await prisma.weeklyCycle.update({
    where: { id: prev.id },
    data: { status: 'CLOSED', closedAt: new Date() },
  });
  logger.info(
    { cycle: cycleLabel(prev.isoYear, prev.isoWeek), missed: missed.count },
    'cycle closed',
  );
  return { cycleId: prev.id, missed: missed.count };
}

/** Human-readable countdown used in the UI banner. */
export function hoursUntil(at: Date): number {
  return Math.max(
    0,
    Math.round(DateTime.fromJSDate(at).setZone(zone).diff(now(), 'hours').hours * 10) / 10,
  );
}
