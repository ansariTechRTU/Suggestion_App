/**
 * Runs immediately before `prisma db push`.
 *
 * `raw.sql` replaces `suggestions.search_vector` with a GENERATED ALWAYS column,
 * which `schema.prisma` can only describe as `Unsupported("tsvector")?`. On the
 * second and every later `db push`, Prisma sees a plain tsvector in the schema,
 * a generated column in the database, and tries to alter one into the other —
 * which PostgreSQL rejects:
 *
 *   ERROR: column "search_vector" of relation "suggestions" is a generated column
 *
 * So the column is dropped here and `pnpm db:raw` puts it back. The GIN index on
 * it drops with the column and is recreated by the same file. Nothing is lost:
 * every value in it is derived from title and body.
 *
 * Safe on an empty database — `ALTER TABLE IF EXISTS` and `DROP COLUMN IF
 * EXISTS` both no-op when the table has not been created yet.
 */
import '../src/load-env.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE IF EXISTS "suggestions" DROP COLUMN IF EXISTS "search_vector"',
  );
  console.log('pre-push: generated search_vector column cleared (db:raw restores it)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
