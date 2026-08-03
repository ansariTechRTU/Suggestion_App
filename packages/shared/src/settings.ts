/**
 * Runtime settings. Every one of these is editable by an admin in the UI, so
 * behaviour changes never require a deployment.
 */
export const SETTING_DEFAULTS = {
  'quota.enabled': true,
  'quota.perCycle': 1,

  /** Friday, local hour, first reminder to anyone who has not submitted. */
  'reminder.fridayHour': 17,
  /** Monday, local hour, final reminder during the grace window. */
  'reminder.mondayHour': 9,
  /** Monday, local hour, at which the previous cycle closes and misses are recorded. */
  'cycle.graceEndHour': 12,

  'leaderboard.visibleToStaff': true,
  'leaderboard.showNamesToStaff': true,
  'leaderboard.showMissesToStaff': false,

  'board.enabled': true,
  'board.votingEnabled': true,
  'anonymity.enabled': true,

  /** Working days an admin has to move a suggestion out of SUBMITTED. */
  'sla.acknowledgeDays': 3,
  /** Working days an admin has to reach a decision. */
  'sla.decisionDays': 20,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type SettingValue = (typeof SETTING_DEFAULTS)[SettingKey];
export type Settings = { [K in SettingKey]: (typeof SETTING_DEFAULTS)[K] };

export const SETTING_KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[];
