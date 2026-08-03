import { SETTING_DEFAULTS, type SettingKey, type Settings } from '@nk/shared';
import { prisma } from '../prisma.js';

let cache: Settings | null = null;
let cachedAt = 0;
const TTL_MS = 15_000;

/** Defaults merged with whatever admins have overridden. Cached briefly. */
export async function getSettings(force = false): Promise<Settings> {
  if (!force && cache && Date.now() - cachedAt < TTL_MS) return cache;
  const rows = await prisma.setting.findMany();
  const merged = { ...SETTING_DEFAULTS } as Record<string, unknown>;
  for (const row of rows) {
    if (row.key in SETTING_DEFAULTS) merged[row.key] = row.value;
  }
  cache = merged as Settings;
  cachedAt = Date.now();
  return cache;
}

export async function getSetting<K extends SettingKey>(key: K): Promise<Settings[K]> {
  return (await getSettings())[key];
}

export async function updateSettings(
  patch: Record<string, unknown>,
  updatedById: string,
): Promise<Settings> {
  const keys = Object.keys(patch).filter((k): k is SettingKey => k in SETTING_DEFAULTS);
  await prisma.$transaction(
    keys.map((key) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value: patch[key] as object, updatedById },
        update: { value: patch[key] as object, updatedById },
      }),
    ),
  );
  cache = null;
  return getSettings(true);
}
