import { Router } from 'express';
import { Prisma } from '@prisma/client';
import {
  boardQuerySchema,
  commentSchema,
  createSuggestionSchema,
  updateSuggestionSchema,
} from '@nk/shared';
import { prisma } from '../prisma.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { requireAuth, validate, requireStaff } from '../middleware/index.js';
import { serializeSuggestion } from '../services/serializers.js';
import {
  DETAIL_INCLUDE,
  createSuggestion,
  toggleVote,
  withdrawSuggestion,
} from '../services/suggestions.js';
import { cycleViewFor } from '../services/cycles.js';
import { getSettings } from '../services/settings.js';

export const suggestionsRouter = Router();
suggestionsRouter.use(requireAuth);

/** The watch strip: this week, the grace window, and where you stand. */
suggestionsRouter.get('/cycle/current', async (req, res, next) => {
  try {
    res.json(await cycleViewFor(req.user!.id));
  } catch (e) {
    next(e);
  }
});

suggestionsRouter.post(
  '/',
  requireStaff,
  validate(createSuggestionSchema),
  async (req, res, next) => {
    try {
      const code = await createSuggestion(req.user!.id, req.body);
      res.status(201).json({ referenceCode: code });
    } catch (e) {
      next(e);
    }
  },
);

suggestionsRouter.get('/mine', async (req, res, next) => {
  try {
    const rows = await prisma.suggestion.findMany({
      where: { submitterId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: DETAIL_INCLUDE,
    });
    res.json({ items: rows.map((s) => serializeSuggestion(s, req.user!)) });
  } catch (e) {
    next(e);
  }
});

suggestionsRouter.get('/board', validate(boardQuerySchema, 'query'), async (req, res, next) => {
  try {
    const s = await getSettings();
    if (!s['board.enabled']) return res.json({ items: [], nextCursor: null, disabled: true });

    const q = req.query as unknown as {
      q?: string;
      categoryId?: string;
      division?: string;
      status?: string;
      sort: 'recent' | 'votes';
      cursor?: string;
      limit: number;
    };

    const where: Prisma.SuggestionWhereInput = {
      status: q.status ? (q.status as never) : { notIn: ['WITHDRAWN'] },
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.division ? { category: { division: q.division as never } } : {}),
    };

    // Postgres FTS over the generated column, with a LIKE fallback for
    // partial words that to_tsquery would not match.
    if (q.q) {
      const term = q.q.trim();
      const ids = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM suggestions
        WHERE search_vector @@ plainto_tsquery('simple', ${term})
           OR title ILIKE ${'%' + term + '%'}
        LIMIT 500`;
      where.id = { in: ids.map((r) => r.id) };
    }

    const items = await prisma.suggestion.findMany({
      where,
      orderBy:
        q.sort === 'votes' ? [{ voteCount: 'desc' }, { createdAt: 'desc' }] : { createdAt: 'desc' },
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      include: {
        category: true,
        submitter: { select: { id: true, fullName: true, division: true, department: true } },
        votes: { where: { userId: req.user!.id }, select: { userId: true } },
      },
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

suggestionsRouter.get('/:code', async (req, res, next) => {
  try {
    const s = await prisma.suggestion.findUnique({
      where: { referenceCode: req.params.code! },
      include: { ...DETAIL_INCLUDE, votes: { where: { userId: req.user!.id } } },
    });
    if (!s) throw notFound('No suggestion with that reference');

    const isOwn = s.submitterId === req.user!.id;
    const isAdmin = req.user!.role === 'ADMIN';
    const settings = await getSettings();
    if (!isOwn && !isAdmin && !settings['board.enabled']) throw forbidden();

    res.json(serializeSuggestion(s, req.user!));
  } catch (e) {
    next(e);
  }
});

suggestionsRouter.patch('/:code', validate(updateSuggestionSchema), async (req, res, next) => {
  try {
    const s = await prisma.suggestion.findUnique({ where: { referenceCode: req.params.code! } });
    if (!s) throw notFound('No suggestion with that reference');
    if (s.submitterId !== req.user!.id) throw forbidden();
    if (s.status !== 'SUBMITTED') {
      throw badRequest('This is under review now and can no longer be edited');
    }
    const updated = await prisma.suggestion.update({
      where: { id: s.id },
      data: req.body,
      include: DETAIL_INCLUDE,
    });
    res.json(serializeSuggestion(updated, req.user!));
  } catch (e) {
    next(e);
  }
});

suggestionsRouter.delete('/:code', async (req, res, next) => {
  try {
    await withdrawSuggestion(req.user!.id, req.params.code!);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

suggestionsRouter.post('/:code/vote', async (req, res, next) => {
  try {
    const s = await getSettings();
    if (!s['board.votingEnabled']) throw badRequest('Voting is switched off');
    const voted = await toggleVote(req.user!.id, req.params.code!);
    res.json({ voted });
  } catch (e) {
    next(e);
  }
});

suggestionsRouter.post('/:code/comments', validate(commentSchema), async (req, res, next) => {
  try {
    const s = await prisma.suggestion.findUnique({ where: { referenceCode: req.params.code! } });
    if (!s) throw notFound('No suggestion with that reference');

    const isInternal = req.body.isInternal && req.user!.role === 'ADMIN';
    const comment = await prisma.comment.create({
      data: {
        suggestionId: s.id,
        authorId: req.user!.id,
        body: req.body.body,
        isInternal,
      },
      include: { author: { select: { id: true, fullName: true } } },
    });
    res.status(201).json({
      id: comment.id,
      body: comment.body,
      isInternal: comment.isInternal,
      createdAt: comment.createdAt,
      author: comment.author,
    });
  } catch (e) {
    next(e);
  }
});
