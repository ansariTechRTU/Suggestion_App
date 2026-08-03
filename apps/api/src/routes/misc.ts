import { Router } from 'express';
import { leaderboardQuerySchema, preferencesSchema } from '@nk/shared';
import { POINTS } from '@nk/shared';
import { prisma } from '../prisma.js';
import { forbidden } from '../lib/errors.js';
import { requireAuth, validate } from '../middleware/index.js';
import { serializeUser } from '../services/serializers.js';
import { getSettings } from '../services/settings.js';
import { leaderboard, myStanding, orgStats, type Period } from '../services/ranking.js';
import { verifyUnsubscribe } from '../lib/tokens.js';
import { env } from '../env.js';

export const meRouter = Router();
meRouter.use(requireAuth);

meRouter.get('/', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { notificationPref: true },
    });
    const settings = await getSettings();
    res.json({ user: serializeUser(user), settings });
  } catch (e) {
    next(e);
  }
});

meRouter.patch('/preferences', validate(preferencesSchema), async (req, res, next) => {
  try {
    const { locale, remindersEnabled, statusUpdatesEnabled } = req.body;
    if (locale) {
      await prisma.user.update({ where: { id: req.user!.id }, data: { locale } });
    }
    if (remindersEnabled !== undefined || statusUpdatesEnabled !== undefined) {
      await prisma.notificationPref.upsert({
        where: { userId: req.user!.id },
        create: {
          userId: req.user!.id,
          ...(remindersEnabled !== undefined ? { remindersEnabled } : {}),
          ...(statusUpdatesEnabled !== undefined ? { statusUpdatesEnabled } : {}),
        },
        update: {
          ...(remindersEnabled !== undefined ? { remindersEnabled } : {}),
          ...(statusUpdatesEnabled !== undefined ? { statusUpdatesEnabled } : {}),
        },
      });
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { notificationPref: true },
    });
    res.json(serializeUser(user));
  } catch (e) {
    next(e);
  }
});

// ------------------------------------------------------------- leaderboard

export const leaderboardRouter = Router();
leaderboardRouter.use(requireAuth);

/**
 * Visibility is governed by three admin settings, applied here rather than in the
 * UI: staff access, whether names show, and whether misses show. A staff member
 * always sees their own full row.
 */
leaderboardRouter.get('/', validate(leaderboardQuerySchema, 'query'), async (req, res, next) => {
  try {
    const isAdmin = req.user!.role === 'ADMIN';
    const s = await getSettings();
    if (!isAdmin && !s['leaderboard.visibleToStaff']) throw forbidden('The rank list is not open');

    const { period, division } = req.query as unknown as { period: Period; division?: string };
    const rows = await leaderboard({ period, division });
    const hideNames = !isAdmin && !s['leaderboard.showNamesToStaff'];
    const hideMisses = !isAdmin && !s['leaderboard.showMissesToStaff'];

    const shaped = rows.map((r) => {
      const isMe = r.userId === req.user!.id;
      return {
        rank: r.rank,
        userId: isMe || !hideNames ? r.userId : null,
        fullName: isMe ? r.fullName : hideNames ? null : r.fullName,
        isMe,
        division: r.division,
        department: r.department,
        submitted: r.submitted,
        onTime: r.onTime,
        inGrace: r.inGrace,
        missed: hideMisses && !isMe ? null : r.missed,
        exempt: r.exempt,
        accepted: r.accepted,
        implemented: r.implemented,
        votesReceived: r.votesReceived,
        currentStreak: r.currentStreak,
        longestStreak: r.longestStreak,
        acceptanceRate: r.acceptanceRate,
        participationRate: hideMisses && !isMe ? null : r.participationRate,
        score: r.score,
      };
    });

    const mine = await myStanding(req.user!.id, period);
    res.json({
      items: shaped,
      me: mine.row ? { rank: mine.row.rank, score: mine.row.score, of: mine.total } : null,
      points: POINTS,
      period,
      visibility: {
        namesHidden: hideNames,
        missesHidden: hideMisses,
      },
    });
  } catch (e) {
    next(e);
  }
});

// -------------------------------------------------------------- categories

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

categoriesRouter.get('/', async (_req, res, next) => {
  try {
    const items = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
    });
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

// ------------------------------------------------------------------ public

export const publicRouter = Router();

/** No session required: an opt-out link in an email must work in one click. */
publicRouter.get('/unsubscribe', async (req, res, next) => {
  try {
    const userId = verifyUnsubscribe(String(req.query.token ?? ''));
    if (!userId) return res.status(400).send('That unsubscribe link is not valid.');
    await prisma.notificationPref.upsert({
      where: { userId },
      create: { userId, remindersEnabled: false },
      update: { remindersEnabled: false },
    });
    res.redirect(`${env.WEB_ORIGIN}/settings?unsubscribed=1`);
  } catch (e) {
    next(e);
  }
});

publicRouter.get('/health', async (_req, res) => {
  const [db, stats] = await Promise.allSettled([prisma.$queryRaw`SELECT 1`, orgStats()]);
  res.json({
    ok: db.status === 'fulfilled',
    open: stats.status === 'fulfilled' ? stats.value.openCount : null,
  });
});
