/** Mirrors the Prisma enums. Kept here so the web app never imports @prisma/client. */

export const ROLES = ['STAFF', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const DIVISIONS = ['COLLEGE', 'TRAINING_CENTRE', 'ENERGY', 'SHARED'] as const;
export type Division = (typeof DIVISIONS)[number];

export const LOCALES = ['EN', 'LV', 'LT', 'RU', 'KA'] as const;
export type Locale = (typeof LOCALES)[number];

export const SUGGESTION_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'ACCEPTED',
  'REJECTED',
  'DEFERRED',
  'IMPLEMENTED',
  'WITHDRAWN',
] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

/** Statuses that close a suggestion out of the review queue. */
export const TERMINAL_STATUSES: SuggestionStatus[] = ['REJECTED', 'IMPLEMENTED', 'WITHDRAWN'];

/** Transitions an admin is allowed to make. Enforced server-side. */
export const ALLOWED_TRANSITIONS: Record<SuggestionStatus, SuggestionStatus[]> = {
  SUBMITTED: ['UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'DEFERRED'],
  UNDER_REVIEW: ['ACCEPTED', 'REJECTED', 'DEFERRED'],
  ACCEPTED: ['IMPLEMENTED', 'DEFERRED', 'REJECTED'],
  DEFERRED: ['UNDER_REVIEW', 'ACCEPTED', 'REJECTED'],
  REJECTED: [],
  IMPLEMENTED: [],
  WITHDRAWN: [],
};

/** A written reason is mandatory when moving into these. */
export const REASON_REQUIRED_FOR: SuggestionStatus[] = ['REJECTED', 'DEFERRED'];

export const CYCLE_STATUSES = ['OPEN', 'GRACE', 'CLOSED'] as const;
export type CycleStatus = (typeof CYCLE_STATUSES)[number];

export const PARTICIPATION_STATUSES = [
  'PENDING',
  'SUBMITTED_ON_TIME',
  'SUBMITTED_IN_GRACE',
  'MISSED',
  'EXEMPT',
] as const;
export type ParticipationStatus = (typeof PARTICIPATION_STATUSES)[number];
