import { timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";
import { publicUrl } from "@/lib/http";
import { saveConnection } from "@/lib/strava/connection";
import { exchangeCode, STRAVA_SCOPE } from "@/lib/strava/oauth";
import { verifyOAuthState } from "@/lib/strava/state";

export const runtime = "nodejs";

const NONCE_COOKIE = "wl_oauth_nonce";

function redirectAndClearNonce(path: string): NextResponse {
  const response = NextResponse.redirect(publicUrl(path), 302);
  response.cookies.set(NONCE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

function nonceMatches(stored: string, received: string): boolean {
  const left = Buffer.from(stored, "utf8");
  const right = Buffer.from(received, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function GET(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.redirect(publicUrl("/unlock"), 302);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return redirectAndClearNonce("/connect?error=denied");
  }

  if (!code || !state) {
    return redirectAndClearNonce("/connect?error=invalid_callback");
  }

  const env = getEnv();
  const verified = verifyOAuthState(state, env.APP_SECRET);
  if (!verified.ok || verified.userId !== userId) {
    return redirectAndClearNonce("/connect?error=invalid_callback");
  }

  const store = await cookies();
  const storedNonce = store.get(NONCE_COOKIE)?.value;
  if (!storedNonce || !nonceMatches(storedNonce, verified.nonce)) {
    return redirectAndClearNonce("/connect?error=invalid_callback");
  }

  try {
    const token = await exchangeCode({
      clientId: env.STRAVA_CLIENT_ID,
      clientSecret: env.STRAVA_CLIENT_SECRET,
      code,
    });
    await saveConnection(userId, token, token.scope ?? STRAVA_SCOPE);
  } catch (caught) {
    if (
      caught instanceof Prisma.PrismaClientKnownRequestError &&
      caught.code === "P2002"
    ) {
      return redirectAndClearNonce("/connect?error=already_linked");
    }
    return redirectAndClearNonce("/connect?error=exchange_failed");
  }

  return redirectAndClearNonce("/");
}
