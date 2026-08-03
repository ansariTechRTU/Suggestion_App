import { prisma } from '../prisma.js';

export async function audit(o: {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: o.actorId,
      action: o.action,
      targetType: o.targetType,
      targetId: o.targetId,
      metadata: (o.metadata ?? {}) as object,
      ip: o.ip,
    },
  });
}
