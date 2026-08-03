/**
 * Applies prisma/raw.sql through Prisma instead of psql.
 *
 * Two reasons: nobody has to install a PostgreSQL client to set the project up,
 * and it works unchanged on Render, where only Node is available.
 *
 * raw.sql holds the three things Prisma cannot express — the generated tsvector
 * column, the partial unique index behind the weekly quota, and the vote-count
 * trigger. Every statement is written to be safe to run twice.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import '../src/load-env.js';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, 'raw.sql'), 'utf8');

/**
 * Splits the file into statements.
 *
 * Comment-only lines are dropped first — an earlier version accumulated them into
 * the buffer and then rejected any statement that began with `--`, which silently
 * discarded three of the six statements, including the unique index that enforces
 * the weekly quota. Semicolons inside a $$ … $$ function body are ignored.
 */
function statements(input: string): string[] {
  const out: string[] = [];
  let buf: string[] = [];
  let inDollar = false;

  for (const line of input.split('\n')) {
    // No string literal in raw.sql contains "--", so this is safe here.
    const code = inDollar ? line : line.replace(/--.*$/, '');
    if (!inDollar && code.trim() === '') continue;

    const dollars = (code.match(/\$\$/g) ?? []).length;
    if (dollars % 2 === 1) inDollar = !inDollar;

    buf.push(code);

    if (!inDollar && code.trimEnd().endsWith(';')) {
      const stmt = buf.join('\n').trim();
      if (stmt) out.push(stmt);
      buf = [];
    }
  }

  const tail = buf.join('\n').trim();
  if (tail) out.push(tail);
  return out;
}

const prisma = new PrismaClient();

async function main() {
  const list = statements(sql);
  console.log(`raw.sql: applying ${list.length} statements`);
  for (const [i, stmt] of list.entries()) {
    const label = stmt.split('\n')[0]!.slice(0, 62);
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log(`  ${i + 1}/${list.length}  ${label}`);
    } catch (err) {
      console.error(`  ${i + 1}/${list.length}  FAILED  ${label}`);
      throw err;
    }
  }
  console.log('raw.sql applied');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
