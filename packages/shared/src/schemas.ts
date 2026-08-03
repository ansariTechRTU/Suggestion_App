import { z } from 'zod';
import {
  DIVISIONS,
  LOCALES,
  ROLES,
  SUGGESTION_STATUSES,
  PARTICIPATION_STATUSES,
} from './enums.js';

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const createSuggestionSchema = z.object({
  title: z.string().trim().min(8, 'Give it a title of at least 8 characters').max(140),
  body: z.string().trim().min(40, 'Describe the suggestion in at least 40 characters').max(4000),
  categoryId: z.string().uuid(),
  isAnonymous: z.boolean().default(false),
});
export type CreateSuggestionInput = z.infer<typeof createSuggestionSchema>;

export const updateSuggestionSchema = createSuggestionSchema.partial().omit({ isAnonymous: true });

export const commentSchema = z.object({
  body: z.string().trim().min(2).max(2000),
  isInternal: z.boolean().default(false),
});

export const boardQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  categoryId: z.string().uuid().optional(),
  division: z.enum(DIVISIONS).optional(),
  status: z.enum(SUGGESTION_STATUSES).optional(),
  sort: z.enum(['recent', 'votes']).default('recent'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const adminQueueQuerySchema = boardQuerySchema.extend({
  assigneeId: z.string().uuid().optional(),
  unassigned: z.coerce.boolean().optional(),
  overdue: z.coerce.boolean().optional(),
});

export const changeStatusSchema = z.object({
  toStatus: z.enum(SUGGESTION_STATUSES),
  reason: z.string().trim().max(2000).optional(),
  qmsActionRef: z.string().trim().max(64).optional(),
});

export const assignSchema = z.object({
  assigneeId: z.string().uuid().nullable(),
  dueDate: z.coerce.date().nullable().optional(),
});

export const responseSchema = z.object({
  responseBody: z.string().trim().min(10, 'A response needs at least 10 characters').max(4000),
});

export const preferencesSchema = z.object({
  locale: z.enum(LOCALES).optional(),
  remindersEnabled: z.boolean().optional(),
  statusUpdatesEnabled: z.boolean().optional(),
});

export const categorySchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens only'),
  nameI18n: z.record(z.string().min(1)),
  division: z.enum(DIVISIONS).default('SHARED'),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateUserSchema = z.object({
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
  division: z.enum(DIVISIONS).optional(),
  department: z.string().trim().max(80).nullable().optional(),
  fullName: z.string().trim().min(2).max(120).optional(),
});

export const settingsPatchSchema = z.record(z.union([z.boolean(), z.number(), z.string()]));

export const exemptSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(PARTICIPATION_STATUSES),
  note: z.string().trim().max(500).optional(),
});

export const leaderboardQuerySchema = z.object({
  period: z.enum(['all', 'year', 'quarter']).default('quarter'),
  division: z.enum(DIVISIONS).optional(),
});
