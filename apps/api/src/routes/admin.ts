import { Router } from 'express';
import { Prisma } from '@prisma/client';
import {
  adminQueueQuerySchema,
  assignSchema,
  categorySchema,
  changeStatusSchema,
  exemptSchema,
  responseSchema,
  settingsPatchSchema,
  updateUserSchema,
} from '@nk/shared';
import { prisma } from '../prisma.js';
import { notFound } from '../lib/errors.js';
import { requireAdmin, validate } from '../middleware/index.js';
import { serializeSuggestion, serializeUser } from '../services/serializers.js';
import {
  DETAIL_INCLUDE,
  assign,
  changeStatus,
  postResponse,
} from '../services/suggestions.js';
import { getSettings, updateSettings } from '../services/settings.js';
import { orgStats } from '../services/ranking.js';
import { audit } from '../services/audit.js';
import { triggerJob } from '../jobs/index.js';
import { closePreviousCycle, ensureCurrentCycle, seedParticipations } from '../services/cycles.js';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

// ----------------------------------------------------------------- queue

adminRouter.get('/suggestions', validate(adminQueueQuerySchema, 'query'), async (req, res, next) => {
  try {
    const q = req.query as unknown as {
      q?: string;
      status?: string;
      categoryId?: string;
      assigneeId?: string;
      unassigned?: boolean;
      overdue?: boolean;
      sort: 'recent' | 'votes';
      cursor?: string;
      limit: number;
    };

    const where: Prisma.SuggestionWhereInput = {
      ...(q.status ? { status: q.status as never } : { status: { notIn: ['WITHDRAWN'] } }),
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.assigneeId ? { assigneeId: q.assigneeId } : {}),
      ...(q.unassigned ? { assigneeId: null } : {}),
      ...(q.overdue
        ? { dueDate: { lt: new Date() }, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } }
        : {}),
    };

    if (q.q) {
      const ids = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM suggestions
        WHERE search_vector @@ plainto_tsquery('simple', ${q.q})
           OR reference_code ILIKE ${'%' + q.q + '%'}
        LIMIT 500`;
      where.id = { in: ids.map((r) => r.id) };
    }

    const items = await prisma.suggestion.findMany({
      where,
      orderBy: q.sort === 'votes' ? [{ voteCount: 'desc' }] : [{ createdAt: 'asc' }],
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      include: DETAIL_INCLUDE,
    });

    const hasMore = items.length > q.limit;
    const page = hasMore ? items.slice(0, q.limit) : items;
    res.json({
      items: page.map((s) => serializeSuggestion(s, req.user!)),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    });
  } catch (e) {
    next(e);
  }
});

adminRouter.get('/dashboard', async (_req, res, next) => {
  try {
    const [stats, byStatus, cycles, lastRuns] = await Promise.all([
      orgStats(),
      prisma.suggestion.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.weeklyCycle.findMany({
        orderBy: [{ isoYear: 'desc' }, { isoWeek: 'desc' }],
        take: 8,
        include: {
          _count: { select: { suggestions: true } },
          participations: { select: { status: true } },
        },
      }),
      prisma.reminderRun.findMany({ orderBy: { startedAt: 'desc' }, take: 5 }),
    ]);

    res.json({
      stats,
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
      cycles: cycles.map((c) => ({
        id: c.id,
        isoYear: c.isoYear,
        isoWeek: c.isoWeek,
        status: c.status,
        suggestions: c._count.suggestions,
        onTime: c.participations.filter((p) => p.status === 'SUBMITTED_ON_TIME').length,
        inGrace: c.participations.filter((p) => p.status === 'SUBMITTED_IN_GRACE').length,
        missed: c.participations.filter((p) => p.status === 'MISSED').length,
        pending: c.participations.filter((p) => p.status === 'PENDING').length,
        exempt: c.participations.filter((p) => p.status === 'EXEMPT').length,
      })),
      lastRuns,
    });
  } catch (e) {
    next(e);
  }
});

// ------------------------------------------------------- decisions & work

adminRouter.patch(
  '/suggestions/:code/status',
  validate(changeStatusSchema),
  async (req, res, next) => {
    try {
      const updated = await changeStatus({
        actorId: req.user!.id,
        code: req.params.code!,
        toStatus: req.body.toStatus,
        reason: req.body.reason,
        qmsActionRef: req.body.qmsActionRef,
      });
      await audit({
        actorId: req.user!.id,
        action: `status:${req.body.toStatus}`,
        targetType: 'suggestion',
        targetId: updated.id,
        metadata: { reason: req.body.reason ?? null },
        ip: req.ip,
      });
      res.json({ ok: true, status: updated.status });
    } catch (e) {
      next(e);
    }
  },
);

adminRouter.patch('/suggestions/:code/assign', validate(assignSchema), async (req, res, next) => {
  try {
    const updated = await assign({
      actorId: req.user!.id,
      code: req.params.code!,
      assigneeId: req.body.assigneeId,
      dueDate: req.body.dueDate,
    });
    await audit({
      actorId: req.user!.id,
      action: req.body.assigneeId ? 'assign' : 'unassign',
      targetType: 'suggestion',
      targetId: updated.id,
      metadata: { assigneeId: req.body.assigneeId },
      ip: req.ip,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

adminRouter.post('/suggestions/:code/response', validate(responseSchema), async (req, res, next) => {
  try {
    const updated = await postResponse({
      actorId: req.user!.id,
      code: req.params.code!,
      responseBody: req.body.responseBody,
    });
    res.json({ ok: true, respondedAt: updated.respondedAt });
  } catch (e) {
    next(e);
  }
});

/**
 * Revealing who is behind an anonymous submission. Separate endpoint on purpose:
 * it is the one read in the system that writes an audit record.
 */
adminRouter.post('/suggestions/:code/reveal', async (req, res, next) => {
  try {
    const s = await prisma.suggestion.findUnique({
      where: { referenceCode: req.params.code! },
      include: { submitter: { select: { id: true, fullName: true, email: true } } },
    });
    if (!s) throw notFound('No suggestion with that reference');
    await audit({
      actorId: req.user!.id,
      action: 'reveal_anonymous_submitter',
      targetType: 'suggestion',
      targetId: s.id,
      metadata: { referenceCode: s.referenceCode },
      ip: req.ip,
    });
    res.json({ submitter: s.submitter, logged: true });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------- people

adminRouter.get('/users', async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
      include: { notificationPref: true },
    });
    res.json({ items: users.map(serializeUser) });
  } catch (e) {
    next(e);
  }
});

adminRouter.patch('/users/:id', validate(updateUserSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id! },
      data: req.body,
      include: { notificationPref: true },
    });
    await audit({
      actorId: req.user!.id,
      action: 'update_user',
      targetType: 'user',
      targetId: user.id,
      metadata: req.body,
      ip: req.ip,
    });
    res.json(serializeUser(user));
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------- cycles

adminRouter.get('/cycles/:id/participations', async (req, res, next) => {
  try {
    const rows = await prisma.cycleParticipation.findMany({
      where: { cycleId: req.params.id! },
      include: {
        user: { select: { id: true, fullName: true, division: true, department: true } },
        suggestion: { select: { referenceCode: true, title: true, status: true } },
      },
      orderBy: [{ status: 'asc' }, { user: { fullName: 'asc' } }],
    });
    res.json({ items: rows });
  } catch (e) {
    next(e);
  }
});

/** Exemptions: leave and sick weeks must not register as misses. */
adminRouter.patch('/cycles/:id/participation', validate(exemptSchema), async (req, res, next) => {
  try {
    const row = await prisma.cycleParticipation.update({
      where: { cycleId_userId: { cycleId: req.params.id!, userId: req.body.userId } },
      data: {
        status: req.body.status,
        note: req.body.note ?? null,
        resolvedById: req.user!.id,
      },
    });
    await audit({
      actorId: req.user!.id,
      action: `participation:${req.body.status}`,
      targetType: 'cycle_participation',
      targetId: row.id,
      metadata: { note: req.body.note ?? null },
      ip: req.ip,
    });
    res.json(row);
  } catch (e) {
    next(e);
  }
});

adminRouter.post('/cycles/open', async (_req, res, next) => {
  try {
    const cycle = await ensureCurrentCycle();
    const seeded = await seedParticipations(cycle.id);
    res.json({ cycle, seeded });
  } catch (e) {
    next(e);
  }
});

adminRouter.post('/cycles/close', async (_req, res, next) => {
  try {
    res.json(await closePreviousCycle());
  } catch (e) {
    next(e);
  }
});

// -------------------------------------------------------------- settings

adminRouter.get('/settings', async (_req, res, next) => {
  try {
    res.json(await getSettings(true));
  } catch (e) {
    next(e);
  }
});

adminRouter.patch('/settings', validate(settingsPatchSchema), async (req, res, next) => {
  try {
    const updated = await updateSettings(req.body, req.user!.id);
    await audit({
      actorId: req.user!.id,
      action: 'update_settings',
      targetType: 'settings',
      targetId: 'global',
      metadata: req.body,
      ip: req.ip,
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// ------------------------------------------------------------ categories

adminRouter.get('/categories', async (_req, res, next) => {
  try {
    res.json({
      items: await prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] }),
    });
  } catch (e) {
    next(e);
  }
});

adminRouter.post('/categories', validate(categorySchema), async (req, res, next) => {
  try {
    res.status(201).json(await prisma.category.create({ data: req.body }));
  } catch (e) {
    next(e);
  }
});

adminRouter.patch('/categories/:id', validate(categorySchema.partial()), async (req, res, next) => {
  try {
    res.json(await prisma.category.update({ where: { id: req.params.id! }, data: req.body }));
  } catch (e) {
    next(e);
  }
});

// ------------------------------------------------------------------ jobs

/** Manual triggers, so the Friday/Monday rhythm can be rehearsed before launch. */
adminRouter.post('/jobs/:name/run', async (req, res, next) => {
  try {
    const result = await triggerJob(req.params.name!);
    await audit({
      actorId: req.user!.id,
      action: `run_job:${req.params.name!}`,
      targetType: 'job',
      targetId: req.params.name!,
      ip: req.ip,
    });
    res.json({ ok: true, result });
  } catch (e) {
    next(e);
  }
});

adminRouter.get('/audit', async (_req, res, next) => {
  try {
    const items = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { actor: { select: { fullName: true } } },
    });
    res.json({ items });
  } catch (e) {
    next(e);
  }
});
