import { NeedsReauthError, StravaRateLimitedError, StravaSyncError } from "./errors";
import type { WalkSession } from "./types";

const ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities";
const PAGE_SIZE = 100;
const MAX_PAGES = 6;

export type RateInfo = {
  shortUsage: number;
  shortLimit: number;
  dailyUsage: number;
  dailyLimit: number;
};

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function parsePair(header: string | null): [number, number] | null {
  if (!header) return null;

  const parts = header.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 2) return null;
  if (!Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;

  return [parts[0], parts[1]];
}

function parseRate(headers: Headers): RateInfo | null {
  const limit = parsePair(headers.get("X-ReadRateLimit-Limit"));
  const usage = parsePair(headers.get("X-ReadRateLimit-Usage"));
  if (!limit || !usage) return null;

  return {
    shortUsage: usage[0],
    shortLimit: limit[0],
    dailyUsage: usage[1],
    dailyLimit: limit[1],
  };
}

function toWalk(item: unknown): WalkSession | null {
  if (typeof item !== "object" || item === null) return null;

  const record = item as Record<string, unknown>;
  if (record.type !== "Walk" && record.sport_type !== "Walk") return null;

  return {
    id: String(record.id ?? ""),
    name: String(record.name ?? "Walk"),
    startLocal: String(record.start_date_local ?? ""),
    distanceM: toNumber(record.distance),
    movingTimeS: toNumber(record.moving_time),
    elapsedTimeS: toNumber(record.elapsed_time),
  };
}

export async function fetchWalks(
  accessToken: string,
  afterEpochSec: number,
  beforeEpochSec: number,
): Promise<{ walks: WalkSession[]; rate: RateInfo | null }> {
  const walks: WalkSession[] = [];
  let rate: RateInfo | null = null;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = new URL(ACTIVITIES_URL);
    url.searchParams.set("after", String(afterEpochSec));
    url.searchParams.set("before", String(beforeEpochSec));
    url.searchParams.set("per_page", String(PAGE_SIZE));
    url.searchParams.set("page", String(page));

    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (response.status === 429) {
      throw new StravaRateLimitedError();
    }

    if (response.status === 401) {
      throw new NeedsReauthError();
    }

    if (!response.ok) {
      throw new StravaSyncError(`strava_activities_failed:${response.status}`);
    }

    const parsedRate = parseRate(response.headers);
    if (parsedRate) rate = parsedRate;

    const body: unknown = await response.json().catch(() => null);
    if (!Array.isArray(body)) {
      throw new StravaSyncError("strava_activities_malformed");
    }

    for (const item of body) {
      const walk = toWalk(item);
      if (walk) walks.push(walk);
    }

    if (body.length < PAGE_SIZE) break;
  }

  return { walks, rate };
}
