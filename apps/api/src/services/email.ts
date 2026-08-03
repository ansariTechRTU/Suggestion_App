import { Resend } from 'resend';
import type { EmailTemplate, Locale } from '@prisma/client';
import { env } from '../env.js';
import { logger } from '../logger.js';
import { prisma } from '../prisma.js';

const client = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export interface SendArgs {
  to: string;
  subject: string;
  html: string;
  template: EmailTemplate;
  locale: Locale;
  userId?: string | null;
}

/**
 * Every send is logged before it leaves, so a missing email can be distinguished
 * from a delivered-but-filtered one. MAIL_DRY_RUN prints instead of sending,
 * which is what you want locally — no API key, no accidental mail to colleagues.
 */
export async function sendEmail(a: SendArgs): Promise<{ ok: boolean; id?: string }> {
  const log = await prisma.emailLog.create({
    data: {
      userId: a.userId ?? null,
      toEmail: a.to,
      template: a.template,
      locale: a.locale,
      status: 'QUEUED',
    },
  });

  if (env.MAIL_DRY_RUN || !client) {
    logger.info({ to: a.to, subject: a.subject, template: a.template }, '[dry-run] email');
    if (!env.isProd) {
      const preview = a.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 240);
      logger.debug({ preview }, '[dry-run] body');
    }
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'SENT', sentAt: new Date() },
    });
    return { ok: true };
  }

  try {
    const res = await client.emails.send({
      from: env.MAIL_FROM,
      to: a.to,
      subject: a.subject,
      html: a.html,
    });
    if (res.error) throw new Error(res.error.message);
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'SENT', sentAt: new Date(), resendId: res.data?.id ?? null },
    });
    return { ok: true, id: res.data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message, to: a.to }, 'email send failed');
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', errorText: message },
    });
    return { ok: false };
  }
}

/**
 * Resend's per-second request limit is well below our burst size when reminding
 * ~100 people at once, so batches go out in chunks with a pause between them.
 */
export async function sendChunked(
  items: SendArgs[],
  chunkSize = 20,
  pauseMs = 1100,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const results = await Promise.all(chunk.map(sendEmail));
    for (const r of results) r.ok ? (sent += 1) : (failed += 1);
    if (i + chunkSize < items.length) await new Promise((r) => setTimeout(r, pauseMs));
  }
  return { sent, failed };
}

export const resendConfigured = () => !!client;
