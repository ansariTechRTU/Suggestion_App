import { DateTime } from 'luxon';
import { env } from '../env.js';

export const zone = env.TIMEZONE;

export const now = () => DateTime.now().setZone(zone);

export interface CycleBounds {
  isoYear: number;
  isoWeek: number;
  startsAt: Date;
  endsAt: Date;
  graceEndsAt: Date;
}

/**
 * Bounds of the ISO week containing `at`, in the configured timezone.
 *
 * on-time deadline : Sunday 23:59:59 of that week
 * grace deadline   : Monday `graceEndHour`:00 of the following week
 */
export function cycleBoundsFor(at: DateTime = now(), graceEndHour = 12): CycleBounds {
  const local = at.setZone(zone);
  const start = local.startOf('week'); // Luxon weeks start Monday
  const end = start.plus({ days: 6 }).endOf('day');
  const grace = start.plus({ weeks: 1 }).set({
    hour: graceEndHour,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  return {
    isoYear: start.weekYear,
    isoWeek: start.weekNumber,
    startsAt: start.toJSDate(),
    endsAt: end.toJSDate(),
    graceEndsAt: grace.toJSDate(),
  };
}

export function previousCycleBounds(graceEndHour = 12): CycleBounds {
  return cycleBoundsFor(now().minus({ weeks: 1 }), graceEndHour);
}

/** "2026-W32" — used in the UI and in email subject lines. */
export function cycleLabel(isoYear: number, isoWeek: number): string {
  return `${isoYear}-W${String(isoWeek).padStart(2, '0')}`;
}

/** Working days from `from`, skipping Saturday and Sunday. Used for SLA dates. */
export function addWorkingDays(from: Date, days: number): Date {
  let d = DateTime.fromJSDate(from).setZone(zone);
  let remaining = days;
  while (remaining > 0) {
    d = d.plus({ days: 1 });
    if (d.weekday <= 5) remaining -= 1;
  }
  return d.toJSDate();
}
