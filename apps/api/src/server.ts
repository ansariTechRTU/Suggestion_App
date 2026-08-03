import { createApp } from './app.js';
import { env } from './env.js';
import { logger } from './logger.js';
import { prisma } from './prisma.js';
import { startJobs, stopJobs } from './jobs/index.js';
import { ensureCurrentCycle } from './services/cycles.js';

const app = createApp();

const server = app.listen(env.PORT, async () => {
  logger.info(`api listening on http://localhost:${env.PORT}`);
  try {
    await ensureCurrentCycle();
    await startJobs();
  } catch (e) {
    logger.error({ e }, 'startup tasks failed');
  }
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  server.close();
  await stopJobs().catch(() => undefined);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
