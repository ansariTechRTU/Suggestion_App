/**
 * Runs the Prisma CLI with the repo-root `.env` loaded.
 *
 * The Prisma CLI only looks for `.env` in the current working directory and
 * next to `schema.prisma`. Every `pnpm db:*` script runs with the working
 * directory set to `apps/api`, so the root `.env` — the one the README tells
 * you to create — was invisible and `db push` failed with
 * "Environment variable not found: DATABASE_URL".
 *
 * Usage:  node scripts/prisma.mjs db push
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));

loadEnv({ path: resolve(here, '../../../.env') });
loadEnv({ path: resolve(here, '../.env') });

if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL is not set. Copy .env.example to .env in the repository root and fill it in:\n' +
      '  cp .env.example .env      (PowerShell: Copy-Item .env.example .env)',
  );
  process.exit(1);
}

import { createRequire } from 'node:module';

/**
 * Resolve the CLI from node_modules rather than trusting PATH: `node
 * scripts/prisma.mjs …` run outside a pnpm script has no node_modules/.bin on
 * PATH and would fail silently.
 */
const require = createRequire(import.meta.url);
let command = process.execPath;
let args = process.argv.slice(2);

try {
  args = [require.resolve('prisma/build/index.js'), ...args];
} catch {
  command = 'prisma';
}

const result = spawnSync(command, args, {
  stdio: 'inherit',
  // On Windows a PATH-resolved prisma is prisma.CMD, which needs a shell.
  shell: command === 'prisma' && process.platform === 'win32',
});

if (result.error) {
  console.error('Could not run the Prisma CLI:', result.error.message);
  console.error('Run `pnpm install` first.');
  process.exit(1);
}

process.exit(result.status ?? 1);
