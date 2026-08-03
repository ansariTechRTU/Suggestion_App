import { Router, raw } from 'express';
import { Webhook } from 'svix';
import { env } from '../env.js';
import { logger } from '../logger.js';
import { prisma } from '../prisma.js';

export const webhooksRouter = Router();

/**
 * Resend delivery events. Raw body, because the signature is computed over bytes.
 * Without this endpoint you cannot tell "nobody cares" from "everything is in Junk".
 */
webhooksRouter.post('/resend', raw({ type: 'application/json' }), async (req, res) => {
  let payload: { type?: string; data?: { email_id?: string } };

  if (env.RESEND_WEBHOOK_SECRET) {
    try {
      const wh = new Webhook(env.RESEND_WEBHOOK_SECRET);
      payload = wh.verify(req.body as Buffer, req.headers as Record<string, string>) as never;
    } catch (e) {
      logger.warn({ e }, 'rejected webhook with bad signature');
      return res.status(401).json({ ok: false });
    }
  } else {
    payload = JSON.parse((req.body as Buffer).toString('utf8'));
  }

  const resendId = payload.data?.email_id;
  if (!resendId) return res.json({ ok: true });

  const log = await prisma.emailLog.findUnique({ where: { resendId } });
  if (!log) return res.json({ ok: true });

  const now = new Date();
  switch (payload.type) {
    case 'email.delivered':
      await prisma.emailLog.update({
        where: { id: log.id },
        data: { status: 'DELIVERED', deliveredAt: now },
      });
      break;
    case 'email.opened':
      await prisma.emailLog.update({ where: { id: log.id }, data: { openedAt: now } });
      break;
    case 'email.bounced':
      await prisma.emailLog.update({
        where: { id: log.id },
        data: { status: 'BOUNCED', bouncedAt: now },
      });
      if (log.userId) {
        // Stop reminding an address that keeps bouncing.
        await prisma.notificationPref.upsert({
          where: { userId: log.userId },
          create: { userId: log.userId, hardBounced: true, remindersEnabled: false },
          update: { hardBounced: true, remindersEnabled: false },
        });
      }
      break;
    case 'email.complained':
      await prisma.emailLog.update({ where: { id: log.id }, data: { status: 'COMPLAINED' } });
      if (log.userId) {
        await prisma.notificationPref.upsert({
          where: { userId: log.userId },
          create: { userId: log.userId, remindersEnabled: false },
          update: { remindersEnabled: false },
        });
      }
      break;
    default:
      break;
  }

  res.json({ ok: true });
});
