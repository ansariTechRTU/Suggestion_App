import type { Locale } from '@nk/shared';
import { COPY } from './copy.js';
import { escapeHtml, layout, statItem } from './layout.js';

export interface Rendered {
  subject: string;
  html: string;
}

export function loginLinkEmail(o: { locale: Locale; url: string }): Rendered {
  const t = COPY[o.locale];
  return {
    subject: t.loginSubject,
    html: layout({
      preheader: t.loginBody,
      heading: t.loginHeading,
      bodyHtml: `<p>${t.loginBody}</p>`,
      ctaLabel: t.loginCta,
      ctaUrl: o.url,
      footerHtml: `${escapeHtml(t.loginExpiry)}<br>${escapeHtml(t.ignoreIfNotYou)}`,
    }),
  };
}

export interface ReminderContext {
  locale: Locale;
  weekLabel: string;
  submitUrl: string;
  unsubscribeUrl: string;
  implementedThisYear: number;
  acceptedThisYear: number;
  /** One real, recently implemented suggestion. The reminder must carry proof. */
  highlight?: { referenceCode: string; title: string } | null;
}

function reminderBody(t: (typeof COPY)[Locale], c: ReminderContext, intro: string): string {
  const stats = `<table role="presentation" cellpadding="0" cellspacing="0"
      style="margin:20px 0 4px"><tr>
      ${statItem(c.implementedThisYear, `${t.statImplemented} ${t.statThisYear}`)}
      ${statItem(c.acceptedThisYear, `${t.statAccepted} ${t.statThisYear}`)}
    </tr></table>`;

  const highlight = c.highlight
    ? `<div style="margin:18px 0 4px;padding:14px 16px;background:#f7f8fa;
         border-left:3px solid #1b7f5c;border-radius:2px">
         <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;
           color:#5b6779;margin-bottom:4px">${escapeHtml(t.recentlyImplemented)}</div>
         <div style="font-size:14px;font-weight:600;color:#1a2233">
           ${escapeHtml(c.highlight.title)}</div>
         <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
           font-size:12px;color:#5b6779">${escapeHtml(c.highlight.referenceCode)}</div>
       </div>`
    : '';

  return `<p>${intro}</p>${highlight}${stats}`;
}

export function fridayReminderEmail(c: ReminderContext): Rendered {
  const t = COPY[c.locale];
  return {
    subject: t.fridaySubject(c.weekLabel),
    html: layout({
      preheader: t.fridayBody,
      heading: t.fridayHeading,
      bodyHtml: reminderBody(t, c, t.fridayBody),
      ctaLabel: t.fridayCta,
      ctaUrl: c.submitUrl,
      footerHtml: `<a href="${c.unsubscribeUrl}" style="color:#5b6779">${escapeHtml(
        t.unsubscribe,
      )}</a>`,
    }),
  };
}

export function mondayReminderEmail(c: ReminderContext): Rendered {
  const t = COPY[c.locale];
  return {
    subject: t.mondaySubject(c.weekLabel),
    html: layout({
      preheader: t.mondayHeading,
      heading: t.mondayHeading,
      bodyHtml: reminderBody(t, c, t.mondayBody(c.weekLabel)),
      ctaLabel: t.mondayCta,
      ctaUrl: c.submitUrl,
      footerHtml: `<a href="${c.unsubscribeUrl}" style="color:#5b6779">${escapeHtml(
        t.unsubscribe,
      )}</a>`,
    }),
  };
}

export function statusChangedEmail(o: {
  locale: Locale;
  referenceCode: string;
  status: string;
  reason?: string | null;
  url: string;
}): Rendered {
  const t = COPY[o.locale];
  const reason = o.reason
    ? `<blockquote style="margin:14px 0;padding:10px 14px;border-left:3px solid #d3d9e3;
         color:#5b6779">${escapeHtml(o.reason)}</blockquote>`
    : '';
  return {
    subject: t.statusSubject(o.referenceCode),
    html: layout({
      preheader: `${o.referenceCode} — ${o.status}`,
      heading: t.statusHeading,
      bodyHtml: `<p>${t.statusBody(escapeHtml(o.referenceCode), escapeHtml(o.status))}</p>${reason}`,
      ctaLabel: t.viewCta,
      ctaUrl: o.url,
    }),
  };
}

export function responsePostedEmail(o: {
  locale: Locale;
  referenceCode: string;
  responseBody: string;
  url: string;
}): Rendered {
  const t = COPY[o.locale];
  return {
    subject: t.statusSubject(o.referenceCode),
    html: layout({
      preheader: t.responseBody(o.referenceCode),
      heading: t.responseHeading,
      bodyHtml: `<p>${t.responseBody(escapeHtml(o.referenceCode))}</p>
        <blockquote style="margin:14px 0;padding:10px 14px;border-left:3px solid #022367">
        ${escapeHtml(o.responseBody)}</blockquote>`,
      ctaLabel: t.viewCta,
      ctaUrl: o.url,
    }),
  };
}

export function assignedEmail(o: {
  locale: Locale;
  referenceCode: string;
  title: string;
  url: string;
}): Rendered {
  const t = COPY[o.locale];
  return {
    subject: t.assignedSubject(o.referenceCode),
    html: layout({
      preheader: t.assignedBody(o.referenceCode),
      heading: t.assignedHeading,
      bodyHtml: `<p>${t.assignedBody(escapeHtml(o.referenceCode))}</p>
        <p style="font-weight:600">${escapeHtml(o.title)}</p>`,
      ctaLabel: t.viewCta,
      ctaUrl: o.url,
    }),
  };
}

export { COPY } from './copy.js';
