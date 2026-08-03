import type { Role } from '@nk/shared';

const ANON = { id: null, fullName: null, division: null, department: null };

interface Actor {
  id: string;
  role: Role;
}

/**
 * The single place submitter identity is decided. Anonymity is enforced here, on
 * the way out, rather than by discarding the identity at write time — so abuse
 * can still be traced, with an audit entry, by an admin who needs to.
 */
export function serializeSuggestion(s: any, actor: Actor) {
  const isOwn = s.submitterId === actor.id;
  const hide = s.isAnonymous && !isOwn;

  const comments = (s.comments ?? [])
    .filter((c: any) => actor.role === 'ADMIN' || !c.isInternal)
    .map((c: any) => ({
      id: c.id,
      body: c.body,
      isInternal: c.isInternal,
      createdAt: c.createdAt,
      author: c.author ? { id: c.author.id, fullName: c.author.fullName } : null,
    }));

  return {
    id: s.id,
    referenceCode: s.referenceCode,
    title: s.title,
    body: s.body,
    status: s.status,
    isAnonymous: s.isAnonymous,
    isOwn,
    voteCount: s.voteCount,
    hasVoted: Array.isArray(s.votes) ? s.votes.length > 0 : undefined,
    submittedInGrace: s.submittedInGrace,
    category: s.category
      ? { id: s.category.id, key: s.category.key, nameI18n: s.category.nameI18n }
      : null,
    cycle: s.cycle
      ? { id: s.cycle.id, isoYear: s.cycle.isoYear, isoWeek: s.cycle.isoWeek }
      : null,
    submitter: hide
      ? ANON
      : s.submitter
        ? {
            id: s.submitter.id,
            fullName: s.submitter.fullName,
            division: s.submitter.division,
            department: s.submitter.department,
          }
        : ANON,
    assignee: s.assignee ? { id: s.assignee.id, fullName: s.assignee.fullName } : null,
    dueDate: s.dueDate,
    responseBody: s.responseBody,
    respondedAt: s.respondedAt,
    qmsActionRef: actor.role === 'ADMIN' ? s.qmsActionRef : undefined,
    createdAt: s.createdAt,
    decidedAt: s.decidedAt,
    closedAt: s.closedAt,
    statusHistory: (s.statusHistory ?? []).map((h: any) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      reason: h.reason,
      changedAt: h.changedAt,
      changedBy: h.changedBy ? { fullName: h.changedBy.fullName } : null,
    })),
    comments,
    attachments: (s.attachments ?? []).map((a: any) => ({
      id: a.id,
      filename: a.filename,
      sizeBytes: a.sizeBytes,
      mimeType: a.mimeType,
    })),
  };
}

export function serializeUser(u: any) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    division: u.division,
    department: u.department,
    locale: u.locale,
    role: u.role,
    isActive: u.isActive,
    remindersEnabled: u.notificationPref?.remindersEnabled ?? true,
    statusUpdatesEnabled: u.notificationPref?.statusUpdatesEnabled ?? true,
  };
}
