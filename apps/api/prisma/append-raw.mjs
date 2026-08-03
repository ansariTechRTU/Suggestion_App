/**
 * Appends prisma/raw.sql into the most recently generated migration.
 *
 * Why: search_vector is a GENERATED column and the one-per-cycle rule is a
 * PARTIAL unique index. Prisma can express neither. If they are applied outside
 * migration history, the next `migrate dev` reads them as drift and offers to
 * reset the database. Folding them into the migration keeps history the single
 * source of truth.
 */
import { readdirSync, readFileSync, appendFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, 'migrations');
const raw = readFileSync(join(import.meta.dirname, 'raw.sql'), 'utf8');

const latest = readdirSync(dir)
  .filter((d) => statSync(join(dir, d)).isDirectory())
  .sort()
  .pop();

if (!latest) {
  console.error('No migration found. Run `prisma migrate dev --create-only` first.');
  process.exit(1);
}

const target = join(dir, latest, 'migration.sql');
const existing = readFileSync(target, 'utf8');

if (existing.includes('suggestions_one_per_cycle_idx')) {
  console.log(`raw.sql already present in ${latest}`);
  process.exit(0);
}

appendFileSync(target, `\n\n-- ==== appended from prisma/raw.sql ====\n${raw}`);
console.log(`raw.sql appended to ${latest}/migration.sql`);
