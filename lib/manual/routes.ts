import { z } from "zod";
import type { ActivityRoute } from "@prisma/client";
import { prisma } from "@/lib/db";

export type StoredRoutePoint = [lat: number, lng: number, elapsedS: number];

export const routeBodySchema = z.object({
  points: z
    .array(
      z.tuple([
        z.number().min(-90).max(90),
        z.number().min(-180).max(180),
        z.number().min(0).max(172800),
      ]),
    )
    .min(2)
    .max(2000),
});

export type RouteBody = z.infer<typeof routeBodySchema>;

async function ownedActivity(userId: string, activityId: string) {
  return prisma.manualActivity.findFirst({
    where: { id: activityId, userId },
    select: { id: true },
  });
}

export async function saveRoute(
  userId: string,
  activityId: string,
  points: RouteBody["points"],
): Promise<ActivityRoute | null> {
  const activity = await ownedActivity(userId, activityId);
  if (!activity) return null;

  return prisma.activityRoute.upsert({
    where: { activityId },
    update: { points, pointCount: points.length },
    create: { activityId, points, pointCount: points.length },
  });
}

export async function loadRoute(
  userId: string,
  activityId: string,
): Promise<ActivityRoute | null> {
  const activity = await ownedActivity(userId, activityId);
  if (!activity) return null;

  return prisma.activityRoute.findUnique({ where: { activityId } });
}

export async function removeRoute(
  userId: string,
  activityId: string,
): Promise<boolean> {
  const activity = await ownedActivity(userId, activityId);
  if (!activity) return false;

  const result = await prisma.activityRoute.deleteMany({ where: { activityId } });
  return result.count > 0;
}
