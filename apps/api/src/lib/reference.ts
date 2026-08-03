import type { Prisma } from '@prisma/client';

/**
 * SUG-2026-0142 — sequential within the calendar year.
 * Generated inside the submission transaction, so the count cannot race.
 */
export async function nextReferenceCode(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `SUG-${year}-`;
  const last = await tx.suggestion.findFirst({
    where: { referenceCode: { startsWith: prefix } },
    orderBy: { referenceCode: 'desc' },
    select: { referenceCode: true },
  });
  const n = last ? Number(last.referenceCode.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(4, '0')}`;
}
