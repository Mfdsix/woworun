import type { ManualActivity } from "@prisma/client";
import { prisma } from "@/lib/db";
import { activityKey } from "@/lib/import/activity-store";
import { parseManualActivities } from "@/lib/import/manual-activities";
import type { WalkSession } from "@/lib/strava/types";

export type ManualAddResult = {
  added: number;
  duplicates: number;
  rejected: number;
  otherSport: number;
  invalid: number;
};

export type ManualImportItem = {
  walk: WalkSession;
  points: number;
};

export function manualToWalk(row: ManualActivity): WalkSession {
  return {
    id: row.id,
    name: row.name,
    startLocal: row.startLocal,
    distanceM: row.distanceM,
    movingTimeS: row.movingTimeS,
    elapsedTimeS: row.elapsedTimeS,
  };
}

export function listManualActivities(userId: string): Promise<ManualActivity[]> {
  return prisma.manualActivity.findMany({
    where: { userId },
    orderBy: { startLocal: "desc" },
  });
}

function toRows(userId: string, items: ManualImportItem[]) {
  return items.map(({ walk, points }) => ({
    userId,
    activityKey: activityKey(walk),
    name: walk.name,
    startLocal: walk.startLocal,
    distanceM: walk.distanceM,
    movingTimeS: walk.movingTimeS,
    elapsedTimeS: walk.elapsedTimeS,
    points,
  }));
}

export async function addManualText(userId: string, text: string): Promise<ManualAddResult> {
  const parsed = parseManualActivities(text);

  if (parsed.items.length === 0) {
    return {
      added: 0,
      duplicates: 0,
      rejected: parsed.rejected,
      otherSport: parsed.otherSport,
      invalid: parsed.invalid,
    };
  }

  const data = toRows(userId, parsed.items);
  const result = await prisma.manualActivity.createMany({ data, skipDuplicates: true });

  return {
    added: result.count,
    duplicates: data.length - result.count,
    rejected: parsed.rejected,
    otherSport: parsed.otherSport,
    invalid: parsed.invalid,
  };
}

export async function importManualItems(
  userId: string,
  items: ManualImportItem[],
): Promise<{ added: number; duplicates: number }> {
  if (items.length === 0) return { added: 0, duplicates: 0 };

  const data = toRows(userId, items);
  const result = await prisma.manualActivity.createMany({ data, skipDuplicates: true });
  return { added: result.count, duplicates: data.length - result.count };
}

export async function clearManualActivities(userId: string): Promise<number> {
  const result = await prisma.manualActivity.deleteMany({ where: { userId } });
  return result.count;
}
