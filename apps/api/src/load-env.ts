/**
 * Loads `.env` from a path relative to this file rather than to the current
 * working directory.
 *
 * `import 'dotenv/config'` resolves `.env` against `process.cwd()`, which is
 * `apps/api` whenever pnpm runs a script in this package — so the repo-root
 * `.env` the README asks you to create was never picked up, and every entry
 * point (server, seeds, raw.sql) started with no DATABASE_URL.
 *
 * Repo root is loaded first, then an optional `apps/api/.env` for per-app
 * overrides. dotenv never overwrites a variable that is already set, so real
 * environment variables — Render's, CI's, or your shell's — always win.
 *
 * Import this module before anything that reads `process.env`.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));

loadEnv({ path: resolve(here, '../../../.env') });
loadEnv({ path: resolve(here, '../.env') });
