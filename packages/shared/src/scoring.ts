/**
 * The ranking formula, deliberately published in the UI.
 *
 * Weighting rationale: an accepted suggestion is worth more than two and a half
 * on-time submissions, and an implemented one is worth five. Turning up matters,
 * but it cannot out-score being useful — which is what stops a weekly quota from
 * producing filler.
 */
export const POINTS = {
  implemented: 10,
  accepted: 5,
  submittedOnTime: 2,
  submittedInGrace: 1,
  voteReceived: 0.5,
  missed: -3,
} as const;

export interface StaffTally {
  userId: string;
  fullName: string;
  division: string;
  department: string | null;
  submitted: number;
  onTime: number;
  inGrace: number;
  missed: number;
  exempt: number;
  accepted: number;
  implemented: number;
  rejected: number;
  votesReceived: number;
  currentStreak: number;
  longestStreak: number;
}

export interface RankedStaff extends StaffTally {
  score: number;
  /** Accepted or implemented, as a share of decided suggestions. 0 when none decided. */
  acceptanceRate: number;
  participationRate: number;
  rank: number;
}

export function scoreOf(t: StaffTally): number {
  const raw =
    t.implemented * POINTS.implemented +
    t.accepted * POINTS.accepted +
    t.onTime * POINTS.submittedOnTime +
    t.inGrace * POINTS.submittedInGrace +
    t.votesReceived * POINTS.voteReceived +
    t.missed * POINTS.missed;
  return Math.round(raw * 10) / 10;
}

export function acceptanceRateOf(t: StaffTally): number {
  const decided = t.accepted + t.implemented + t.rejected;
  if (decided === 0) return 0;
  return Math.round(((t.accepted + t.implemented) / decided) * 100);
}

export function participationRateOf(t: StaffTally): number {
  const expected = t.onTime + t.inGrace + t.missed;
  if (expected === 0) return 100;
  return Math.round(((t.onTime + t.inGrace) / expected) * 100);
}

/**
 * Ranks with ties sharing a position: two staff on 40 points are both 3rd and
 * the next is 5th. Tie-break order is score, then acceptance rate, then fewest
 * misses, then name — so the ordering is stable across requests.
 */
export function rank(tallies: StaffTally[]): RankedStaff[] {
  const scored = tallies
    .map((t) => ({
      ...t,
      score: scoreOf(t),
      acceptanceRate: acceptanceRateOf(t),
      participationRate: participationRateOf(t),
      rank: 0,
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.acceptanceRate - a.acceptanceRate ||
        a.missed - b.missed ||
        a.fullName.localeCompare(b.fullName),
    );

  let lastScore = Number.NaN;
  let lastRank = 0;
  scored.forEach((row, i) => {
    if (row.score === lastScore) {
      row.rank = lastRank;
    } else {
      row.rank = i + 1;
      lastRank = row.rank;
      lastScore = row.score;
    }
  });
  return scored;
}
