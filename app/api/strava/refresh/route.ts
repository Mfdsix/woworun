import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/auth/ratelimit";
import { publicUrl } from "@/lib/http";
import { NeedsReauthError, StravaRateLimitedError } from "@/lib/strava/errors";
import { getDashboard } from "@/lib/strava/sync";

export const runtime = "nodejs";

const COOLDOWN_MS = 60_000;

function redirectTo(path: string): NextResponse {
  return NextResponse.redirect(publicUrl(path), 303);
}

export async function POST(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return redirectTo("/unlock");
  }

  const cooldown = await consumeRateLimit(`sync:manual:${userId}`, 1, COOLDOWN_MS);
  if (!cooldown.allowed) {
    return redirectTo("/strava?sync=wait");
  }

  try {
    await getDashboard(userId, { force: true });
    return redirectTo("/strava?sync=ok");
  } catch (error) {
    if (error instanceof NeedsReauthError) {
      return redirectTo("/strava?sync=reauth");
    }
    if (error instanceof StravaRateLimitedError) {
      return redirectTo("/strava?sync=rate_limited");
    }
    return redirectTo("/strava?sync=failed");
  }
}
