import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { env } from './env.js';
import { logger } from './logger.js';
import { attachUser, errorHandler, notFoundHandler } from './middleware/index.js';
import { authRouter } from './routes/auth.js';
import { suggestionsRouter } from './routes/suggestions.js';
import { adminRouter } from './routes/admin.js';
import { webhooksRouter } from './routes/webhooks.js';
import { categoriesRouter, leaderboardRouter, meRouter, publicRouter } from './routes/misc.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));

  // Webhooks first: they need the raw body, before the JSON parser.
  app.use('/api/webhooks', webhooksRouter);

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(attachUser);

  app.use('/api', rateLimit({ windowMs: 60_000, limit: 300 }));

  app.use('/api/auth', authRouter);
  app.use('/api/me', meRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/suggestions', suggestionsRouter);
  app.use('/api/leaderboard', leaderboardRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', publicRouter);

  /**
   * Single-service deployment: serve the built web app from this process. One
   * origin means the session cookie stays first-party and there is no CORS or
   * cross-site cookie configuration to get wrong.
   */
  if (env.SERVE_WEB) {
    const here = dirname(fileURLToPath(import.meta.url));
    const dist = resolve(here, '../../web/dist');

    if (existsSync(dist)) {
      app.use(express.static(dist, { index: false, maxAge: '1h' }));
      // SPA fallback for browser navigation only; /api keeps its 404s.
      app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(dist, 'index.html')));
      logger.info({ dist }, 'serving web build');
    } else {
      logger.warn({ dist }, 'SERVE_WEB is on but no web build found — run pnpm build:web');
    }
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
