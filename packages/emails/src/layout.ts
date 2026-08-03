/**
 * Plain HTML templates rather than react-email: no JSX build step in the API
 * process, no runtime render dependency, and mail clients get markup we control
 * exactly. Swap in react-email later if the templates outgrow this.
 */

const NAVY = '#0a2463'; // Novikontas Academy — Navy Blue
const RULE = '#d7dee8';
const INK = '#011111'; // Pitch Black
const MUTED = '#56637d';

export interface LayoutOptions {
  preheader: string;
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerHtml?: string;
}

export function layout(o: LayoutOptions): string {
  const cta =
    o.ctaLabel && o.ctaUrl
      ? `<tr><td style="padding:8px 0 24px">
           <a href="${o.ctaUrl}" style="display:inline-block;background:${NAVY};color:#fff;
              text-decoration:none;padding:13px 22px;border-radius:3px;font-weight:600;
              font-size:15px;letter-spacing:.01em">${o.ctaLabel}</a>
         </td></tr>`
      : '';

  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(o.heading)}</title></head>
<body style="margin:0;padding:0;background:#f7f8fa;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  color:${INK}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
  style="background:#f7f8fa;padding:32px 16px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="max-width:560px;background:#fff;border:1px solid ${RULE};border-radius:4px">
      <tr><td style="padding:24px 28px 0">
        <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;
          color:${NAVY};font-weight:700">Novikontas Academy</div>
        <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;
          color:${MUTED}">Staff suggestions</div>
      </td></tr>
      <tr><td style="padding:20px 28px 0">
        <div style="height:1px;background:${RULE}"></div>
      </td></tr>
      <tr><td style="padding:22px 28px 0">
        <h1 style="margin:0 0 14px;font-size:21px;line-height:1.25;font-weight:700;
          color:${NAVY};letter-spacing:-.01em">${escapeHtml(o.heading)}</h1>
      </td></tr>
      <tr><td style="padding:0 28px;font-size:15px;line-height:1.6;color:${INK}">
        ${o.bodyHtml}
      </td></tr>
      <tr><td style="padding:0 28px">
        <table role="presentation" cellpadding="0" cellspacing="0">${cta}</table>
      </td></tr>
      <tr><td style="padding:0 28px 26px;font-size:12px;line-height:1.6;color:${MUTED}">
        <div style="height:1px;background:${RULE};margin:4px 0 14px"></div>
        ${o.footerHtml ?? ''}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function statItem(value: string | number, label: string): string {
  return `<td style="padding:0 18px 0 0">
    <div style="font-size:24px;font-weight:700;color:${NAVY};line-height:1.1">${value}</div>
    <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:${MUTED}">
      ${escapeHtml(label)}</div>
  </td>`;
}
