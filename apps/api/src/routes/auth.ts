import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requestLinkSchema } from '@nk/shared';
import { loginLinkEmail } from '@nk/emails';
import { env } from '../env.js';
import { prisma } from '../prisma.js';
import { hashToken, randomToken } from '../lib/tokens.js';
import { validate } from '../middleware/index.js';
import { sendEmail } from '../services/email.js';
import { ensureCurrentCycle } from '../services/cycles.js';
import { startSession } from '../services/session.js';
import { googleRouter } from './google.js';
import { logger } from '../logger.js';

export const authRouter = Router();

/** Google Workspace sign-in lives at /api/auth/google. */
authRouter.use('/google', googleRouter);

/**
 * What sign-in methods this deployment offers, so the login screen can render
 * the right buttons instead of guessing.
 */
authRouter.get('/config', (_req, res) => {
  res.json({
    google: env.googleEnabled,
    demo: env.demoEnabled,
    magicLink: env.magicLinkEnabled,
    domains: env.allowedDomains,
  });
});

const LINK_TTL_MIN = 15;

const perEmail = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  keyGenerator: (req) => String(req.body?.email ?? req.ip),
  message: { error: { message: 'Too many sign-in attempts. Try again in a few minutes.' } },
});

const perIp = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20 });

authRouter.post(
  '/request-link',
  perIp,
  validate(requestLinkSchema),
  perEmail,
  async (req, res, next) => {
    try {
      if (!env.magicLinkEnabled) {
        return res.status(404).json({ error: { message: 'Not found' } });
      }

      const { email } = req.body as { email: string };
      const domain = email.split('@')[1] ?? '';

      // Identical response either way: never reveal whether an address exists.
      const generic = {
        ok: true,
        message: 'If that address is recognised, a sign-in link is on its way.',
      };

      if (!env.allowedDomains.includes(domain)) {
        logger.info({ domain }, 'rejected sign-in for non-org domain');
        return res.json(generic);
      }

      const requester = await prisma.user.findUnique({ where: { email } });

      const token = randomToken();
      await prisma.$transaction([
        // Any earlier link for this address stops working the moment a new one is issued.
        prisma.authToken.updateMany({
          where: { email, consumedAt: null },
          data: { consumedAt: new Date() },
        }),
        prisma.authToken.create({
          data: {
            email,
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + LINK_TTL_MIN * 60 * 1000),
            ip: req.ip,
            userAgent: req.get('user-agent') ?? undefined,
          },
        }),
      ]);

      const existing = requester;
      const url = `${env.API_PUBLIC_URL}/api/auth/verify?token=${token}`;
      const mail = loginLinkEmail({ locale: existing?.locale ?? 'EN', url });

      await sendEmail({
        to: email,
        subject: mail.subject,
        html: mail.html,
        template: 'LOGIN_LINK',
        locale: existing?.locale ?? 'EN',
        userId: existing?.id ?? null,
      });

      res.json(generic);
    } catch (e) {
      next(e);
    }
  },
);

authRouter.get('/verify', async (req, res, next) => {
  try {
    if (!env.magicLinkEnabled) return res.redirect(`${env.WEB_ORIGIN}/login`);

    const token = String(req.query.token ?? '');
    const fail = (reason: string) => res.redirect(`${env.WEB_ORIGIN}/login?error=${reason}`);
    if (!token) return fail('missing');

    const row = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row || row.consumedAt || row.expiresAt < new Date()) return fail('expired');

    await prisma.authToken.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });

    const domain = row.email.split('@')[1] ?? '';
    if (!env.allowedDomains.includes(domain)) return fail('domain');

    // First sign-in creates the account. Pre-seeded staff already have theirs,
    // with the correct division and department.
    const user = await prisma.user.upsert({
      where: { email: row.email },
      create: {
        email: row.email,
        fullName: row.email.split('@')[0]!.replace(/[._-]+/g, ' '),
        notificationPref: { create: {} },
      },
      update: { lastLoginAt: new Date() },
    });
    if (!user.isActive) return fail('inactive');

    await startSession(req, res, user.id);

    // A brand new user needs a participation row for the open week.
    await ensureCurrentCycle();

    res.redirect(`${env.WEB_ORIGIN}/suggestions/mine`);
  } catch (e) {
    next(e);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    if (req.sessionId) {
      await prisma.session.delete({ where: { id: req.sessionId } }).catch(() => undefined);
    }
    res.clearCookie(env.SESSION_COOKIE_NAME, { path: '/' });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------- demo mode

/**
 * Demo sign-in. Active only when DEMO_MODE=true.
 *
 * The real flow emails a magic link, which needs a verified Resend domain — more
 * setup than a demo should require. These two endpoints let a visitor pick a
 * seeded persona and be signed in immediately.
 *
 * Guards: DEMO_MODE must be on, the address must already exist in the database,
 * and it must sit on an allowlisted domain. It cannot create accounts.
 */
authRouter.get('/demo-users', async (_req, res, next) => {
  try {
    if (!env.demoEnabled) return res.status(404).json({ error: { message: 'Not found' } });
    const users = await prisma.user.findMany({
      where: { isActive: true },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
      select: {
        email: true,
        fullName: true,
        role: true,
        division: true,
        department: true,
        locale: true,
      },
    });
    res.json({ demo: true, items: users });
  } catch (e) {
    next(e);
  }
});

authRouter.post('/demo-login', validate(requestLinkSchema), async (req, res, next) => {
  try {
    if (!env.demoEnabled) return res.status(404).json({ error: { message: 'Not found' } });

    const { email } = req.body as { email: string };
    const domain = email.split('@')[1] ?? '';
    if (!env.allowedDomains.includes(domain)) {
      return res.status(400).json({ error: { message: 'Not a demo account' } });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return res.status(400).json({ error: { message: 'Not a demo account' } });
    }

    await startSession(req, res, user.id);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await ensureCurrentCycle();

    logger.info({ email, role: user.role }, 'demo sign-in');
    res.json({ ok: true, role: user.role });
  } catch (e) {
    next(e);
  }
});
