import {
  ALLOWED_TRANSITIONS,
  REASON_REQUIRED_FOR,
  type CreateSuggestionInput,
  type SuggestionStatus,
} from '@nk/shared';
import { assignedEmail, responsePostedEmail, statusChangedEmail } from '@nk/emails';
import { Prisma } from '@prisma/client';
import { env } from '../env.js';
import { prisma } from '../prisma.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { addWorkingDays } from '../lib/time.js';
import { nextReferenceCode } from '../lib/reference.js';
import { targetCycleFor } from './cycles.js';
import { getSettings } from './settings.js';
import { sendEmail } from './email.js';
import { logger } from '../logger.js';

export const DETAIL_INCLUDE = {
  category: true,
  submitter: { select: { id: true, fullName: true, division: true, department: true } },
  assignee: { select: { id: true, fullName: true } },
  cycle: { select: { id: true, isoYear: true, isoWeek: true } },
  attachments: true,
  statusHistory: {
    orderBy: { changedAt: 'asc' as const },
    include: { changedBy: { select: { fullName: true } } },
  },
  comments: {
    orderBy: { createdAt: 'asc' as const },
    include: { author: { select: { id: true, fullName: true } } },
  },
} satisfies Prisma.SuggestionInclude;

const webUrl = (code: string) => `${env.WEB_ORIGIN}/suggestions/${code}`;

/**
 * Creates a suggestion and ties it to a cycle in one transaction.
 *
 * The quota is enforced three ways, deliberately: a friendly check here, the
 * participation row update, and a partial unique index in Postgres. The index is
 * the one that actually holds under a double-submit.
 */
export async function createSuggestion(
  userId: string,
  input: CreateSuggestionInput,
): Promise<string> {
  const s = await getSettings();
  const { cycle, inGrace } = await targetCycleFor(userId);

  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, isActive: true },
  });
  if (!category) throw badRequest('Pick a category from the list', 'category_invalid');
  if (input.isAnonymous && !s['anonymity.enabled']) {
    throw badRequest('Anonymous submissions are switched off', 'anonymity_disabled');
  }

  if (s['quota.enabled']) {
    const used = await prisma.suggestion.count({
      where: { submitterId: userId, cycleId: cycle.id, status: { not: 'WITHDRAWN' } },
    });
    if (used >= s['quota.perCycle']) {
      throw conflict(
        `You have already logged this week's suggestion. Withdraw it first if you want to replace it.`,
        'quota_reached',
      );
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const referenceCode = await nextReferenceCode(tx);
      const created = await tx.suggestion.create({
        data: {
          referenceCode,
          title: input.title,
          body: input.body,
          categoryId: input.categoryId,
          submitterId: userId,
          isAnonymous: input.isAnonymous,
          cycleId: cycle.id,
          submittedInGrace: inGrace,
          status: 'SUBMITTED',
          dueDate: addWorkingDays(new Date(), s['sla.decisionDays']),
        },
      });

      await tx.statusHistory.create({
        data: {
          suggestionId: created.id,
          fromStatus: null,
          toStatus: 'SUBMITTED',
          changedById: userId,
          reason: 'Submitted',
        },
      });

      await tx.cycleParticipation.upsert({
        where: { cycleId_userId: { cycleId: cycle.id, userId } },
        create: {
          cycleId: cycle.id,
          userId,
          status: inGrace ? 'SUBMITTED_IN_GRACE' : 'SUBMITTED_ON_TIME',
          suggestionId: created.id,
        },
        update: {
          status: inGrace ? 'SUBMITTED_IN_GRACE' : 'SUBMITTED_ON_TIME',
          suggestionId: created.id,
        },
      });

      return created.referenceCode;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict("You have already logged this week's suggestion.", 'quota_reached');
    }
    throw err;
  }
}

/** Withdrawing frees the week's slot again: the participation row reverts to PENDING. */
export async function withdrawSuggestion(userId: string, code: string) {
  const s = await prisma.suggestion.findUnique({ where: { referenceCode: code } });
  if (!s) throw notFound('No suggestion with that reference');
  if (s.submitterId !== userId) throw forbidden();
  if (s.status !== 'SUBMITTED') {
    throw badRequest('This is already under review and can no longer be withdrawn');
  }

  await prisma.$transaction(async (tx) => {
    await tx.suggestion.update({
      where: { id: s.id },
      data: { status: 'WITHDRAWN', closedAt: new Date(), cycleId: null },
    });
    await tx.statusHistory.create({
      data: {
        suggestionId: s.id,
        fromStatus: s.status,
        toStatus: 'WITHDRAWN',
        changedById: userId,
        reason: 'Withdrawn by submitter',
      },
    });
    if (s.cycleId) {
      await tx.cycleParticipation.updateMany({
        where: { cycleId: s.cycleId, userId },
        data: { status: 'PENDING', suggestionId: null },
      });
    }
  });
}

export async function changeStatus(opts: {
  actorId: string;
  code: string;
  toStatus: SuggestionStatus;
  reason?: string;
  qmsActionRef?: string;
}) {
  const current = await prisma.suggestion.findUnique({
    where: { referenceCode: opts.code },
    include: { submitter: { select: { id: true, email: true, locale: true } } },
  });
  if (!current) throw notFound('No suggestion with that reference');

  const allowed = ALLOWED_TRANSITIONS[current.status as SuggestionStatus];
  if (!allowed.includes(opts.toStatus)) {
    throw badRequest(
      `${current.status} cannot move to ${opts.toStatus}`,
      'transition_not_allowed',
    );
  }
  if (REASON_REQUIRED_FOR.includes(opts.toStatus) && !opts.reason?.trim()) {
    throw badRequest(`A written reason is required to mark this ${opts.toStatus}`, 'reason_required');
  }

  const isDecision = ['ACCEPTED', 'REJECTED', 'DEFERRED'].includes(opts.toStatus);
  const isClosing = ['REJECTED', 'IMPLEMENTED'].includes(opts.toStatus);

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.suggestion.update({
      where: { id: current.id },
      data: {
        status: opts.toStatus,
        qmsActionRef: opts.qmsActionRef ?? current.qmsActionRef,
        acknowledgedAt: current.acknowledgedAt ?? new Date(),
        ...(isDecision ? { decidedAt: new Date() } : {}),
        ...(isClosing ? { closedAt: new Date() } : {}),
      },
    });
    await tx.statusHistory.create({
      data: {
        suggestionId: current.id,
        fromStatus: current.status,
        toStatus: opts.toStatus,
        changedById: opts.actorId,
        reason: opts.reason ?? null,
      },
    });
    return u;
  });

  await notifySubmitter(current.submitter, async (locale) =>
    statusChangedEmail({
      locale,
      referenceCode: current.referenceCode,
      status: opts.toStatus,
      reason: opts.reason,
      url: webUrl(current.referenceCode),
    }),
  ).catch((e) => logger.error({ e }, 'status email failed'));

  return updated;
}

export async function assign(opts: {
  actorId: string;
  code: string;
  assigneeId: string | null;
  dueDate?: Date | null;
}) {
  const s = await prisma.suggestion.findUnique({ where: { referenceCode: opts.code } });
  if (!s) throw notFound('No suggestion with that reference');

  if (opts.assigneeId) {
    const assignee = await prisma.user.findFirst({
      where: { id: opts.assigneeId, isActive: true },
    });
    if (!assignee) throw badRequest('That person is not an active user');
  }

  const updated = await prisma.suggestion.update({
    where: { id: s.id },
    data: {
      assigneeId: opts.assigneeId,
      assignedAt: opts.assigneeId ? new Date() : null,
      ...(opts.dueDate !== undefined ? { dueDate: opts.dueDate } : {}),
    },
    include: { assignee: { select: { email: true, locale: true, id: true } } },
  });

  if (updated.assignee) {
    const mail = assignedEmail({
      locale: updated.assignee.locale,
      referenceCode: s.referenceCode,
      title: s.title,
      url: webUrl(s.referenceCode),
    });
    await sendEmail({
      to: updated.assignee.email,
      subject: mail.subject,
      html: mail.html,
      template: 'ASSIGNED',
      locale: updated.assignee.locale,
      userId: updated.assignee.id,
    }).catch((e) => logger.error({ e }, 'assign email failed'));
  }
  return updated;
}

export async function postResponse(opts: { actorId: string; code: string; responseBody: string }) {
  const s = await prisma.suggestion.findUnique({
    where: { referenceCode: opts.code },
    include: { submitter: { select: { id: true, email: true, locale: true } } },
  });
  if (!s) throw notFound('No suggestion with that reference');

  const updated = await prisma.suggestion.update({
    where: { id: s.id },
    data: { responseBody: opts.responseBody, respondedAt: new Date() },
  });

  await notifySubmitter(s.submitter, async (locale) =>
    responsePostedEmail({
      locale,
      referenceCode: s.referenceCode,
      responseBody: opts.responseBody,
      url: webUrl(s.referenceCode),
    }),
  ).catch((e) => logger.error({ e }, 'response email failed'));

  return updated;
}

/** Respects the submitter's status-update preference. Anonymity does not block it. */
async function notifySubmitter(
  submitter: { id: string; email: string; locale: any },
  build: (locale: any) => Promise<{ subject: string; html: string }>,
) {
  const pref = await prisma.notificationPref.findUnique({ where: { userId: submitter.id } });
  if (pref && !pref.statusUpdatesEnabled) return;
  const mail = await build(submitter.locale);
  await sendEmail({
    to: submitter.email,
    subject: mail.subject,
    html: mail.html,
    template: 'STATUS_CHANGED',
    locale: submitter.locale,
    userId: submitter.id,
  });
}

export async function toggleVote(userId: string, code: string): Promise<boolean> {
  const s = await prisma.suggestion.findUnique({ where: { referenceCode: code } });
  if (!s) throw notFound('No suggestion with that reference');
  const existing = await prisma.vote.findUnique({
    where: { suggestionId_userId: { suggestionId: s.id, userId } },
  });
  if (existing) {
    await prisma.vote.delete({ where: { suggestionId_userId: { suggestionId: s.id, userId } } });
    return false;
  }
  await prisma.vote.create({ data: { suggestionId: s.id, userId } });
  return true;
}
