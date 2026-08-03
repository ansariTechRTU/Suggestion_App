import { Router } from 'express';
import { env } from '../env.js';
import { prisma } from '../prisma.js';
import { googleRouter } from './google.js';

export const authRouter = Router();

/** Google Workspace sign-in lives at /api/auth/google. It is the only way in. */
authRouter.use('/google', googleRouter);

/** Lets the login screen show which domains (if any) are enforced. */
authRouter.get('/config', (_req, res) => {
  res.json({ domains: env.allowedDomains });
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
