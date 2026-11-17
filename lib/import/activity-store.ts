import type { WalkSession } from "../strava/types";

export type StoredActivity = {
  key: string;
  walk: WalkSession;
  points: number;
  addedAt: string;
};

export type IncomingActivity = {
  walk: WalkSession;
  points: number;
};

export const STORAGE_KEY = "walklog.manual.v1";

/**
 * Natural key for deduplication. Deliberately ignores the generated id and the
 * title so a renamed row still resolves to the same activity.
 */
export function activityKey(walk: WalkSession): string {
  return [walk.startLocal.trim(), walk.elapsedTimeS, Math.round(walk.distanceM)].join("|");
}

export function mergeActivities(
  existing: StoredActivity[],
  incoming: IncomingActivity[],
  now = new Date(),
): { items: StoredActivity[]; added: number; duplicates: number } {
  const seen = new Set(existing.map((item) => item.key));
  const items = [...existing];
  let added = 0;
  let duplicates = 0;

  for (const entry of incoming) {
    const key = activityKey(entry.walk);
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }

    seen.add(key);
    items.push({
      key,
      walk: entry.walk,
      points: entry.points,
      addedAt: now.toISOString(),
    });
    added += 1;
  }

  return { items, added, duplicates };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isWalk(value: unknown): value is WalkSession {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.startLocal === "string" &&
    typeof value.distanceM === "number" &&
    Number.isFinite(value.distanceM) &&
    typeof value.movingTimeS === "number" &&
    Number.isFinite(value.movingTimeS) &&
    typeof value.elapsedTimeS === "number" &&
    Number.isFinite(value.elapsedTimeS)
  );
}

function isStoredActivity(value: unknown): value is StoredActivity {
  if (!isRecord(value)) return false;

  return (
    typeof value.key === "string" &&
    value.key.length > 0 &&
    typeof value.points === "number" &&
    Number.isFinite(value.points) &&
    typeof value.addedAt === "string" &&
    isWalk(value.walk)
  );
}

export function parseStored(raw: string | null): StoredActivity[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.items)) {
      return [];
    }
    return parsed.items.filter(isStoredActivity);
  } catch {
    return [];
  }
}

export function serializeStored(items: StoredActivity[]): string {
  return JSON.stringify({ version: 1, items });
}
