import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/auth/ratelimit";
import { NeedsReauthError, StravaRateLimitedError } from "@/lib/strava/errors";
import { getDashboard } from "@/lib/strava/sync";

export const runtime = "nodejs";

const COOLDOWN_MS = 60_000;

function redirectTo(request: Request, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url), 303);
}

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return redirectTo(request, "/unlock");
  }

  const cooldown = await consumeRateLimit(`sync:manual:${userId}`, 1, COOLDOWN_MS);
  if (!cooldown.allowed) {
    return redirectTo(request, "/?sync=wait");
  }

  try {
    await getDashboard(userId, { force: true });
    return redirectTo(request, "/?sync=ok");
  } catch (error) {
    if (error instanceof NeedsReauthError) {
      return redirectTo(request, "/?sync=reauth");
    }
    if (error instanceof StravaRateLimitedError) {
      return redirectTo(request, "/?sync=rate_limited");
    }
    return redirectTo(request, "/?sync=failed");
  }
}
