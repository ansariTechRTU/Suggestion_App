const STATUS_TONE: Record<string, string> = {
  SUBMITTED: 'bg-navy-50 text-navy-700 border-navy-100',
  UNDER_REVIEW: 'bg-amber-50 text-amber border-amber/25',
  ACCEPTED: 'bg-starboard-50 text-starboard border-starboard/25',
  IMPLEMENTED: 'bg-starboard text-white border-starboard',
  REJECTED: 'bg-port-50 text-port border-port/25',
  DEFERRED: 'bg-paper text-muted border-rule',
  WITHDRAWN: 'bg-paper text-muted border-rule',
};

export const statusTone = (s: string) => STATUS_TONE[s] ?? 'bg-paper text-muted border-rule';

export const statusLabel = (s: string) =>
  s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

export function shortDate(iso: string, locale = 'en-GB') {
  return new Date(iso).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function dateTime(iso: string, locale = 'en-GB') {
  return new Date(iso).toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "3 days 4 h" — used for the deadline countdown on the watch strip. */
export function until(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'closed';
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d}d ${h % 24}h`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

export const categoryName = (c: { nameI18n: Record<string, string> } | null, lang: string) =>
  c ? (c.nameI18n[lang] ?? c.nameI18n.en ?? Object.values(c.nameI18n)[0] ?? '—') : '—';
