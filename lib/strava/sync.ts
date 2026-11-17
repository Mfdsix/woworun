import type { Prisma } from "@prisma/client";
import { consumeRateLimit } from "../auth/ratelimit";
import { prisma } from "../db";
import { fetchWalks } from "./activities";
import { getValidAccessToken } from "./connection";
import { NeedsReauthError, StravaRateLimitedError, StravaSyncError } from "./errors";
import { buildDashboard } from "./metrics";
import type { DashboardData } from "./types";

export const SNAPSHOT_TTL_MS = 60 * 60 * 1000;
export const SNAPSHOT_STALE_MAX_MS = 7 * 24 * 60 * 60 * 1000;

const BUDGET_KEY = "strava:global:15m";
const BUDGET_LIMIT = 60;
const BUDGET_WINDOW_MS = 15 * 60 * 1000;
const HISTORY_SECONDS = 365 * 86400;

export type DashboardResult = {
  data: DashboardData;
  computedAt: Date;
  stale: boolean;
};

function parseDashboardPayload(value: unknown): DashboardData | null {
  if (typeof value !== "object" || value === null) return null;

  const candidate = value as Record<string, unknown>;
  const keys = ["month", "last7", "sessions", "recent", "rhythm", "streak", "records"];

  for (const key of keys) {
    const field = candidate[key];
    if (typeof field !== "object" || field === null) return null;
  }

  return value as DashboardData;
}

export async function getDashboard(
  userId: string,
  options?: { force?: boolean },
): Promise<DashboardResult> {
  const now = new Date();
  const existing = await prisma.dashboardSnapshot.findUnique({ where: { userId } });

  if (existing && existing.expiresAt.getTime() > now.getTime() && !options?.force) {
    const cached = parseDashboardPayload(existing.payload);
    if (cached) {
      return { data: cached, computedAt: existing.computedAt, stale: false };
    }
  }

  const staleFallback = (): DashboardResult | null => {
    if (!existing) return null;
    if (now.getTime() - existing.computedAt.getTime() > SNAPSHOT_STALE_MAX_MS) return null;

    const cached = parseDashboardPayload(existing.payload);
    if (!cached) return null;

    return { data: cached, computedAt: existing.computedAt, stale: true };
  };

  const budget = await consumeRateLimit(BUDGET_KEY, BUDGET_LIMIT, BUDGET_WINDOW_MS, now.getTime());
  if (!budget.allowed) {
    const fallback = staleFallback();
    if (fallback) return fallback;
    throw new StravaRateLimitedError("strava_budget_exhausted");
  }

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    throw new NeedsReauthError();
  }

  const nowSeconds = Math.floor(now.getTime() / 1000);
  const after = nowSeconds - HISTORY_SECONDS;
  const before = nowSeconds + 60;

  let walks;
  try {
    const result = await fetchWalks(accessToken, after, before);
    walks = result.walks;
  } catch (error) {
    if (
      error instanceof StravaRateLimitedError ||
      error instanceof StravaSyncError
    ) {
      const fallback = staleFallback();
      if (fallback) return fallback;
    }
    throw error;
  }

  const data = buildDashboard(walks, now);

  // Prisma's Json input type does not accept structurally valid plain objects without widening,
  // so the payload is widened exactly once here after shape validation above.
  const payload = data as unknown as Prisma.InputJsonValue;

  await prisma.dashboardSnapshot.upsert({
    where: { userId },
    create: {
      userId,
      payload,
      computedAt: now,
      expiresAt: new Date(now.getTime() + SNAPSHOT_TTL_MS),
    },
    update: {
      payload,
      computedAt: now,
      expiresAt: new Date(now.getTime() + SNAPSHOT_TTL_MS),
    },
  });

  return { data, computedAt: now, stale: false };
}

export function getCachedDashboard(userId: string): Promise<DashboardResult> {
  return getDashboard(userId);
}
