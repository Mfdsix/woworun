import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { open } from "@/lib/crypto/secret-box";
import { getEnv } from "@/lib/env";
import { deleteConnection, getConnection } from "@/lib/strava/connection";
import { deauthorize } from "@/lib/strava/oauth";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.redirect(new URL("/unlock", request.url), 303);
  }

  const connection = await getConnection(userId);

  if (connection?.accessTokenEnc) {
    try {
      await deauthorize(open(connection.accessTokenEnc, getEnv().APP_SECRET, userId));
    } catch {
      // Best effort: local deletion proceeds even if Strava deauthorization fails.
    }
  }

  await deleteConnection(userId);

  return NextResponse.redirect(new URL("/connect", request.url), 303);
}
