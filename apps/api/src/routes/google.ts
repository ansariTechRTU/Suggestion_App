/**
 * Google Workspace sign-in.
 *
 * The authorisation-code flow, not the implicit one: the browser only ever
 * carries a one-time code, and the code is exchanged for tokens server-to-server
 * with the client secret, which never leaves this process.
 *
 * The domain rule is enforced here, on the server, three times over:
 *
 *   1. `hd` is sent to Google so the account chooser offers work accounts first.
 *      This is a *hint* to the user interface and nothing more — a determined
 *      caller can strip it from the URL, so nothing is allowed to depend on it.
 *   2. The returned ID token's signature, issuer and audience are verified
 *      against Google's published keys.
 *   3. The verified `email_verified`, `hd` and email domain claims are checked
 *      against ALLOWED_EMAIL_DOMAINS before any session is created.
 *
 * Check 3 is the one that actually matters. Personal @gmail.com accounts fail it
 * because they carry no `hd` claim and gmail.com is not an allowlisted domain.
 */
import { Router } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../env.js';
import { prisma } from '../prisma.js';
import { logger } from '../logger.js';
import { ensureCurrentCycle } from '../services/cycles.js';
import { startSession } from '../services/session.js';

export const googleRouter = Router();

const STATE_COOKIE = 'nk_oauth_state';
const STATE_TTL_MS = 10 * 60 * 1000;

const redirectUri = () => `${env.API_PUBLIC_URL}/api/auth/google/callback`;

const client = () =>
  new OAuth2Client({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: redirectUri(),
  });

const fail = (res: import('express').Response, reason: string) =>
  res.redirect(`${env.WEB_ORIGIN}/login?error=${reason}`);

/** Start the flow. */
googleRouter.get('/', rateLimit({ windowMs: 60_000, limit: 20 }), (req, res) => {
  if (!env.googleEnabled) return fail(res, 'google_disabled');

  /**
   * CSRF: a random value goes to Google in the URL and into a cookie the
   * attacker cannot write. The callback only proceeds if the two match, so a
   * forged callback carrying someone else's code is rejected.
   */
  const state = crypto.randomBytes(32).toString('base64url');
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    maxAge: STATE_TTL_MS,
    path: '/api/auth/google',
  });

  const url = client().generateAuthUrl({
    scope: ['openid', 'email', 'profile'],
    state,
    // Ask Google to re-check which account the person wants, rather than
    // silently reusing whichever one the browser signed into last.
    prompt: 'select_account',
    ...(env.GOOGLE_HOSTED_DOMAIN ? { hd: env.GOOGLE_HOSTED_DOMAIN } : {}),
  });

  logger.info({ ip: req.ip }, 'google sign-in started');
  res.redirect(url);
});

/** Google sends the browser back here with a one-time code. */
googleRouter.get('/callback', async (req, res, next) => {
  try {
    if (!env.googleEnabled) return fail(res, 'google_disabled');

    const expected = req.cookies?.[STATE_COOKIE];
    const given = String(req.query.state ?? '');
    res.clearCookie(STATE_COOKIE, { path: '/api/auth/google' });

    if (!expected || !given || expected.length !== given.length) return fail(res, 'state');
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given))) {
      return fail(res, 'state');
    }

    // The person cancelled at Google's screen, or Google refused.
    if (req.query.error) {
      logger.info({ error: req.query.error }, 'google sign-in declined');
      return fail(res, 'google_cancelled');
    }

    const code = String(req.query.code ?? '');
    if (!code) return fail(res, 'google_failed');

    const oauth = client();
    const { tokens } = await oauth.getToken(code);
    if (!tokens.id_token) return fail(res, 'google_failed');

    // Verifies signature, issuer, audience and expiry against Google's keys.
    const ticket = await oauth.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) return fail(res, 'google_failed');

    const email = payload.email.toLowerCase();
    const domain = email.split('@')[1] ?? '';

    // An unverified address on a Workspace domain is not proof of anything.
    if (!payload.email_verified) {
      logger.warn({ email }, 'rejected google sign-in: address not verified');
      return fail(res, 'domain');
    }

    /**
     * The real gate. `hd` is only present on Workspace accounts, so requiring it
     * to match the address domain rules out a personal account that happens to
     * have an allowlisted address attached as an alias.
     */
    const hd = (payload.hd ?? '').toLowerCase();
    if (!env.allowedDomains.includes(domain) || (hd && hd !== domain)) {
      logger.info({ domain, hd }, 'rejected google sign-in for non-org domain');
      return fail(res, 'domain');
    }
    if (!hd) {
      logger.info({ domain }, 'rejected google sign-in: not a workspace account');
      return fail(res, 'domain');
    }

    /**
     * First sign-in creates the account. Pre-seeded staff already have one with
     * the right division and department; for them this only refreshes the name
     * Google holds and the last-login stamp.
     */
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        fullName: payload.name ?? email.split('@')[0]!.replace(/[._-]+/g, ' '),
        lastLoginAt: new Date(),
        notificationPref: { create: {} },
      },
      update: {
        lastLoginAt: new Date(),
        ...(payload.name ? { fullName: payload.name } : {}),
      },
    });

    if (!user.isActive) return fail(res, 'inactive');

    await startSession(req, res, user.id);
    await ensureCurrentCycle();

    logger.info({ email, role: user.role }, 'google sign-in');
    res.redirect(`${env.WEB_ORIGIN}/suggestions/mine`);
  } catch (e) {
    logger.error({ e }, 'google sign-in failed');
    next(e);
  }
});
