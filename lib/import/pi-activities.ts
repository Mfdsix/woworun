import { z } from "zod";
import type { WalkSession } from "../strava/types";

const activitySchema = z
  .object({
    activity_id: z.string(),
    platform_activity_id: z.union([z.string(), z.number()]).optional(),
    activity_date: z.string(),
    start_date: z.string(),
    end_date: z.string(),
    title: z.string(),
    sport_name: z.string(),
    distance: z.number(),
    duration: z.number(),
    points: z.number().optional(),
    points_status: z.string().optional(),
  })
  .passthrough();

const payloadSchema = z
  .object({
    data: z.array(activitySchema),
  })
  .passthrough();

export type PiActivity = z.infer<typeof activitySchema>;

export type PiImport = {
  walks: WalkSession[];
  points: number;
  rejected: number;
};

function diffSeconds(start: string, end: string): number {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 0;
  }
  return Math.round((endMs - startMs) / 1000);
}

/**
 * Maps an Individu Bugar activity payload to the dashboard's WalkSession model.
 * Only walking activities with a counted status are included.
 */
export function parsePiActivities(input: unknown): PiImport {
  const parsed = payloadSchema.parse(input);

  const walks: WalkSession[] = [];
  let points = 0;
  let rejected = 0;

  for (const activity of parsed.data) {
    const isWalking = activity.sport_name.toLowerCase() === "walking";
    const isCounted = !activity.points_status || activity.points_status === "counted";

    if (!isWalking || !isCounted) {
      rejected += 1;
      continue;
    }

    const id =
      activity.platform_activity_id !== undefined
        ? String(activity.platform_activity_id)
        : activity.activity_id;

    walks.push({
      id,
      name: activity.title,
      startLocal: activity.start_date,
      distanceM: activity.distance,
      movingTimeS: activity.duration,
      elapsedTimeS: diffSeconds(activity.start_date, activity.end_date),
    });

    points += activity.points ?? 0;
  }

  return { walks, points, rejected };
}
