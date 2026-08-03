import './load-env.js';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  /** Unpooled connection, used only by `db push`/`migrate` — see schema.prisma. */
  DIRECT_URL: z.string().min(1),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  SESSION_COOKIE_NAME: z.string().default('nk_sid'),
  SESSION_SECRET: z.string().min(16),
  UNSUBSCRIBE_SECRET: z.string().min(16),
  /** Set by Render to the service's public URL; used to build email links. */
  RENDER_EXTERNAL_URL: z.string().url().optional(),
  /**
   * Comma-separated allowlist of Google Workspace domains. Leave blank to let
   * any verified Google account sign in — the state before the organisation's
   * own domain is ready to enforce. Set it once you want to lock the app down
   * to company accounts only.
   */
  ALLOWED_EMAIL_DOMAINS: z.string().default(''),
  RESEND_API_KEY: z.string().default(''),
  MAIL_FROM: z.string().default('Novikontas Suggestions <suggestions@novikontas.org>'),
  RESEND_WEBHOOK_SECRET: z.string().default(''),
  /** Google Workspace sign-in — the only way into the app. Required. */
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  /**
   * Passed to Google as the `hd` hint so the account chooser only offers work
   * accounts. It is a hint, never a control: the callback re-checks the verified
   * domain server-side regardless of what comes back. Leave blank while any
   * Google account is allowed.
   */
  GOOGLE_HOSTED_DOMAIN: z.string().default(''),
  MAIL_DRY_RUN: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  TIMEZONE: z.string().default('Europe/Riga'),
  UPLOAD_DIR: z.string().default('./uploads'),
  /** Serve the built web app from this process — a single Render service. */
  SERVE_WEB: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  MAX_UPLOAD_BYTES: z.coerce.number().default(5 * 1024 * 1024),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment. Copy .env.example to .env and fill it in.');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

/**
 * On Render there is one service and one URL, so the web origin and the API's
 * public URL are the same thing. Deriving them from RENDER_EXTERNAL_URL means the
 * blueprint does not have to hardcode a hostname it cannot know in advance.
 *
 * Trailing slash stripped defensively: routes/google.ts builds the OAuth
 * redirect URI via plain string concatenation (`${API_PUBLIC_URL}/api/auth/...`),
 * so a trailing slash here would silently produce a double slash there — a
 * redirect_uri that looks right at a glance but never matches what's
 * registered in Google Cloud Console.
 */
const external = parsed.data.RENDER_EXTERNAL_URL?.replace(/\/+$/, '');

export const env = {
  ...parsed.data,
  WEB_ORIGIN: external ?? parsed.data.WEB_ORIGIN,
  API_PUBLIC_URL: external ?? parsed.data.API_PUBLIC_URL,
  /**
   * Empty until ALLOWED_EMAIL_DOMAINS is set, at which point Google sign-in
   * starts rejecting every account outside those domains. See google.ts.
   */
  allowedDomains: parsed.data.ALLOWED_EMAIL_DOMAINS.split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean),
  isProd: parsed.data.NODE_ENV === 'production',
};
