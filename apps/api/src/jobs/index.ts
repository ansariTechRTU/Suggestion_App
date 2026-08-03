import PgBoss from 'pg-boss';
import { fridayReminderEmail, mondayReminderEmail } from '@nk/emails';
import type { EmailTemplate } from '@prisma/client';
import { env } from '../env.js';
import { logger } from '../logger.js';
import { prisma } from '../prisma.js';
import { cycleLabel, now } from '../lib/time.js';
import { signUnsubscribe } from '../lib/tokens.js';
import {
  closePreviousCycle,
  ensureCurrentCycle,
  getPreviousCycle,
  seedParticipations,
} from '../services/cycles.js';
import { orgStats } from '../services/ranking.js';
import { sendChunked, type SendArgs } from '../services/email.js';
import { getSettings } from '../services/settings.js';

export const QUEUES = {
  cycleOpen: 'cycle.open',
  fridayReminder: 'reminder.friday',
  mondayReminder: 'reminder.monday',
  cycleClose: 'cycle.close',
} as const;

let boss: PgBoss | null = null;

export async function startJobs(): Promise<void> {
  boss = new PgBoss({ connectionString: env.DATABASE_URL, schema: 'pgboss' });
  boss.on('error', (e) => logger.error({ e }, 'pg-boss error'));
  await boss.start();

  for (const q of Object.values(QUEUES)) {
    try {
      await boss.createQueue(q);
    } catch {
      /* already exists */
    }
  }

  await boss.work(QUEUES.cycleOpen, () => runCycleOpen());
  await boss.work(QUEUES.fridayReminder, () => runReminder('FRIDAY_REMINDER'));
  await boss.work(QUEUES.mondayReminder, () => runReminder('MONDAY_REMINDER'));
  await boss.work(QUEUES.cycleClose, () => runCycleClose());

  const s = await getSettings();
  const tz = env.TIMEZONE;
  //                         min hour dom mon dow
  await boss.schedule(QUEUES.cycleOpen, '5 0 * * 1', {}, { tz });
  await boss.schedule(QUEUES.fridayReminder, `0 ${s['reminder.fridayHour']} * * 5`, {}, { tz });
  await boss.schedule(QUEUES.mondayReminder, `0 ${s['reminder.mondayHour']} * * 1`, {}, { tz });
  await boss.schedule(QUEUES.cycleClose, `5 ${s['cycle.graceEndHour']} * * 1`, {}, { tz });

  logger.info({ tz }, 'schedules registered');
}

export async function stopJobs(): Promise<void> {
  await boss?.stop();
  boss = null;
}

/** Used by the admin "run now" control, so the weekly rhythm is testable. */
export async function triggerJob(name: string): Promise<unknown> {
  switch (name) {
    case QUEUES.cycleOpen:
      return runCycleOpen();
    case QUEUES.fridayReminder:
      return runReminder('FRIDAY_REMINDER');
    case QUEUES.mondayReminder:
      return runReminder('MONDAY_REMINDER');
    case QUEUES.cycleClose:
      return runCycleClose();
    default:
      throw new Error(`Unknown job ${name}`);
  }
}

async function runCycleOpen() {
  const cycle = await ensureCurrentCycle();
  const seeded = await seedParticipations(cycle.id);
  logger.info({ cycleId: cycle.id, seeded }, 'cycle.open done');
  return { cycleId: cycle.id, seeded };
}

async function runCycleClose() {
  const res = await closePreviousCycle();
  logger.info(res, 'cycle.close done');
  return res;
}

/**
 * The reminder rule, in one place:
 *   - Friday targets the current week, still open until Sunday night
 *   - Monday targets last week, inside the grace window until noon
 * Skipped: opted out, hard bounced, inactive, and anyone who already submitted.
 */
async function runReminder(template: Extract<EmailTemplate, 'FRIDAY_REMINDER' | 'MONDAY_REMINDER'>) {
  const isMonday = template === 'MONDAY_REMINDER';
  const cycle = isMonday ? await getPreviousCycle() : await ensureCurrentCycle();

  if (!cycle) {
    logger.warn({ template }, 'no cycle to remind about');
    return { recipients: 0, skipped: 0 };
  }
  if (isMonday && (cycle.status === 'CLOSED' || now().toJSDate() >= cycle.graceEndsAt)) {
    logger.info('grace window already shut, no Monday reminder');
    return { recipients: 0, skipped: 0 };
  }

  const run = await prisma.reminderRun.create({ data: { template, cycleId: cycle.id } });

  const pending = await prisma.cycleParticipation.findMany({
    where: {
      cycleId: cycle.id,
      status: 'PENDING',
      user: { isActive: true },
    },
    include: {
      user: {
        select: { id: true, email: true, locale: true, notificationPref: true },
      },
    },
  });

  const stats = await orgStats();
  const label = cycleLabel(cycle.isoYear, cycle.isoWeek);

  const messages: SendArgs[] = [];
  const remindedIds: string[] = [];
  let skipped = 0;

  for (const p of pending) {
    const pref = p.user.notificationPref;
    if (pref && (!pref.remindersEnabled || pref.hardBounced)) {
      skipped += 1;
      continue;
    }

    const ctx = {
      locale: p.user.locale,
      weekLabel: label,
      submitUrl: `${env.WEB_ORIGIN}/suggestions/new`,
      unsubscribeUrl: `${env.API_PUBLIC_URL}/api/unsubscribe?token=${signUnsubscribe(p.user.id)}`,
      implementedThisYear: stats.implementedThisYear,
      acceptedThisYear: stats.acceptedThisYear,
      highlight: stats.highlight,
    };
    const mail = isMonday ? mondayReminderEmail(ctx) : fridayReminderEmail(ctx);

    messages.push({
      to: p.user.email,
      subject: mail.subject,
      html: mail.html,
      template,
      locale: p.user.locale,
      userId: p.user.id,
    });
    remindedIds.push(p.id);
  }

  const { sent, failed } = await sendChunked(messages);

  await prisma.cycleParticipation.updateMany({
    where: { id: { in: remindedIds } },
    data: isMonday ? { mondayReminderAt: new Date() } : { fridayReminderAt: new Date() },
  });

  await prisma.reminderRun.update({
    where: { id: run.id },
    data: {
      recipientsCount: sent,
      skippedCount: skipped,
      failedCount: failed,
      finishedAt: new Date(),
    },
  });

  logger.info({ template, sent, skipped, failed, cycle: label }, 'reminder run done');
  return { recipients: sent, skipped, failed };
}
