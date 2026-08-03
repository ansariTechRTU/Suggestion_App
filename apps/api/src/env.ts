import './load-env.js';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  SESSION_COOKIE_NAME: z.string().default('nk_sid'),
  SESSION_SECRET: z.string().min(16),
  UNSUBSCRIBE_SECRET: z.string().min(16),
  /** Set by Render to the service's public URL; used to build email links. */
  RENDER_EXTERNAL_URL: z.string().url().optional(),
  ALLOWED_EMAIL_DOMAINS: z.string().min(1),
  RESEND_API_KEY: z.string().default(''),
  MAIL_FROM: z.string().default('Novikontas Suggestions <suggestions@novikontas.org>'),
  RESEND_WEBHOOK_SECRET: z.string().default(''),
  /**
   * Google Workspace sign-in. Both values come from a Google Cloud OAuth 2.0
   * client; leaving either blank turns the button off and leaves the magic-link
   * flow as the only way in.
   */
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  /**
   * Passed to Google as the `hd` hint so the account chooser only offers work
   * accounts. It is a hint, never a control: the callback re-checks the verified
   * domain server-side regardless of what comes back.
   */
  GOOGLE_HOSTED_DOMAIN: z.string().default(''),
  MAIL_DRY_RUN: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  TIMEZONE: z.string().default('Europe/Riga'),
  UPLOAD_DIR: z.string().default('./uploads'),
  /** Demo mode: one-click sign-in as a seeded persona, no email required. */
  DEMO_MODE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
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
 */
const external = parsed.data.RENDER_EXTERNAL_URL;

export const env = {
  ...parsed.data,
  WEB_ORIGIN: external ?? parsed.data.WEB_ORIGIN,
  API_PUBLIC_URL: external ?? parsed.data.API_PUBLIC_URL,
  googleEnabled: Boolean(parsed.data.GOOGLE_CLIENT_ID && parsed.data.GOOGLE_CLIENT_SECRET),
  /**
   * Once Google is configured it is the *only* way in.
   *
   * Every weaker route closes itself: no persona picker, no emailed sign-in
   * link. Two doors into the same account means the weaker one sets the real
   * security level, and an emailed link is only ever as strong as the mailbox
   * it lands in. Google already proves the person holds a live Workspace
   * account on the domain, which is a stronger claim than any link can make.
   *
   * Before Google is configured — a fresh clone, local development — the older
   * routes still work, otherwise there would be no way to open the app at all.
   */
  demoEnabled:
    parsed.data.DEMO_MODE && !(parsed.data.GOOGLE_CLIENT_ID && parsed.data.GOOGLE_CLIENT_SECRET),
  magicLinkEnabled: !(parsed.data.GOOGLE_CLIENT_ID && parsed.data.GOOGLE_CLIENT_SECRET),
  allowedDomains: parsed.data.ALLOWED_EMAIL_DOMAINS.split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean),
  isProd: parsed.data.NODE_ENV === 'production',
};
