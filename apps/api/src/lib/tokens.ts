import crypto from 'node:crypto';
import { env } from '../env.js';

/** Signed, stateless unsubscribe token so opting out never needs a login. */
export function signUnsubscribe(userId: string): string {
  const sig = crypto
    .createHmac('sha256', env.UNSUBSCRIBE_SECRET)
    .update(userId)
    .digest('base64url');
  return `${userId}.${sig}`;
}

export function verifyUnsubscribe(token: string): string | null {
  const [userId, sig] = token.split('.');
  if (!userId || !sig) return null;
  const expected = crypto
    .createHmac('sha256', env.UNSUBSCRIBE_SECRET)
    .update(userId)
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return userId;
}
