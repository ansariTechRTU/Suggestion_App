/**
 * Session creation, in one place.
 *
 * Three routes sign people in — magic link, Google, and the demo picker — and a
 * cookie flag that drifts apart between them is a security bug waiting to
 * happen. They all call this.
 */
import type { Request, Response } from 'express';
import { env } from '../env.js';
import { prisma } from '../prisma.js';

export const SESSION_DAYS = 30;

const MAX_AGE_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

export async function startSession(req: Request, res: Response, userId: string) {
  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt: new Date(Date.now() + MAX_AGE_MS),
      ip: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    },
  });

  res.cookie(env.SESSION_COOKIE_NAME, session.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    maxAge: MAX_AGE_MS,
    path: '/',
  });

  return session;
}
