export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: Record<string, string>,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const json = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const e = json?.error ?? {};
    throw new ApiError(res.status, e.message ?? 'Something went wrong', e.code, e.details);
  }
  return json as T;
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(p: string) => request<T>(p, { method: 'DELETE' }),
};

// ------------------------------------------------------------------- types

export interface Me {
  user: {
    id: string;
    email: string;
    fullName: string;
    division: string;
    department: string | null;
    locale: 'EN' | 'LV' | 'LT' | 'RU' | 'KA';
    role: 'STAFF' | 'ADMIN';
    remindersEnabled: boolean;
    statusUpdatesEnabled: boolean;
  };
  settings: Record<string, boolean | number | string>;
}

export interface CycleView {
  id: string;
  label: string;
  isoYear: number;
  isoWeek: number;
  startsAt: string;
  endsAt: string;
  graceEndsAt: string;
  status: string;
  graceOpen: boolean;
  graceCycle: { id: string; label: string; graceEndsAt: string } | null;
  mySubmission: { referenceCode: string; title: string; status: string } | null;
  myStatus: 'PENDING' | 'SUBMITTED_ON_TIME' | 'SUBMITTED_IN_GRACE' | 'MISSED' | 'EXEMPT';
  quotaEnabled: boolean;
  quotaPerCycle: number;
}

export interface Category {
  id: string;
  key: string;
  nameI18n: Record<string, string>;
  division: string;
}

export interface Suggestion {
  id: string;
  referenceCode: string;
  title: string;
  body: string;
  status: string;
  isAnonymous: boolean;
  isOwn: boolean;
  voteCount: number;
  hasVoted?: boolean;
  submittedInGrace: boolean;
  category: Category | null;
  cycle: { isoYear: number; isoWeek: number } | null;
  submitter: { id: string | null; fullName: string | null; division: string | null };
  assignee: { id: string; fullName: string } | null;
  dueDate: string | null;
  responseBody: string | null;
  respondedAt: string | null;
  qmsActionRef?: string | null;
  createdAt: string;
  statusHistory: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    changedAt: string;
    changedBy: { fullName: string } | null;
  }>;
  comments: Array<{
    id: string;
    body: string;
    isInternal: boolean;
    createdAt: string;
    author: { id: string; fullName: string } | null;
  }>;
}

export interface LeaderRow {
  rank: number;
  userId: string | null;
  fullName: string | null;
  isMe: boolean;
  division: string;
  department: string | null;
  submitted: number;
  onTime: number;
  inGrace: number;
  missed: number | null;
  exempt: number;
  accepted: number;
  implemented: number;
  votesReceived: number;
  currentStreak: number;
  longestStreak: number;
  acceptanceRate: number;
  participationRate: number | null;
  score: number;
}

export interface LeaderboardResponse {
  items: LeaderRow[];
  me: { rank: number; score: number; of: number } | null;
  points: Record<string, number>;
  period: 'all' | 'year' | 'quarter';
  visibility: { namesHidden: boolean; missesHidden: boolean };
}

export interface DemoUser {
  email: string;
  fullName: string;
  role: 'STAFF' | 'ADMIN';
  division: string;
  department: string | null;
  locale: string;
}
