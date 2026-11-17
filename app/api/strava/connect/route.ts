import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";
import { buildAuthorizeUrl } from "@/lib/strava/oauth";
import { createOAuthState } from "@/lib/strava/state";

export const runtime = "nodejs";

const NONCE_COOKIE = "wl_oauth_nonce";

export async function GET(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.redirect(new URL("/unlock", request.url), 302);
  }

  const env = getEnv();
  if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Strava is not configured." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const nonce = randomBytes(16).toString("hex");
  const redirectUri = `${env.APP_URL}/api/strava/callback`;
  const state = createOAuthState(userId, nonce, env.APP_SECRET);
  const authorizeUrl = buildAuthorizeUrl({
    clientId: env.STRAVA_CLIENT_ID,
    redirectUri,
    state,
  });

  const response = NextResponse.redirect(authorizeUrl, 302);
  response.cookies.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}
