import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { env } from '../env.js';
import { logger } from '../logger.js';
import { prisma } from '../prisma.js';
import { AppError, forbidden, unauthorized } from '../lib/errors.js';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: 'STAFF' | 'ADMIN';
  locale: 'EN' | 'LV' | 'LT' | 'RU' | 'KA';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
      sessionId?: string;
    }
  }
}

/** Reads the session cookie and attaches the user. Never throws — that is requireAuth's job. */
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const sid = req.cookies?.[env.SESSION_COOKIE_NAME];
  if (!sid) return next();
  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date() || !session.user.isActive) return next();
    req.sessionId = session.id;
    req.user = {
      id: session.user.id,
      email: session.user.email,
      fullName: session.user.fullName,
      role: session.user.role,
      locale: session.user.locale,
    };
  } catch (e) {
    logger.error({ e }, 'session lookup failed');
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'ADMIN') return next(forbidden('Administrators only'));
  next();
}

type Source = 'body' | 'query' | 'params';

/**
 * Admins review suggestions; they do not file them.
 *
 * An admin submitting into a queue they also judge muddies the audit trail and
 * skews the rank list, so the create route is closed to them at the API rather
 * than only hidden in the interface.
 */
export function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === 'ADMIN') {
    return res.status(403).json({
      error: 'admins_do_not_submit',
      message: 'Admin accounts review suggestions rather than submit them.',
    });
  }
  next();
}

export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(
        new AppError(
          400,
          'Check the highlighted fields',
          'validation_failed',
          flatten(result.error),
        ),
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any)[source] = result.data;
    next();
  };
}

function flatten(err: ZodError) {
  return Object.fromEntries(
    Object.entries(err.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? 'Invalid']),
  );
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { message: 'Not found' } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { message: err.message, code: err.code, details: err.details },
    });
  }
  logger.error({ err }, 'unhandled error');
  res.status(500).json({ error: { message: 'Something went wrong on our side' } });
}
