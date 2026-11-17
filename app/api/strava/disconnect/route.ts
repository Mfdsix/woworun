import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { publicUrl } from "@/lib/http";
import {
  deleteConnection,
  getConnection,
  getValidAccessToken,
} from "@/lib/strava/connection";
import { deauthorize } from "@/lib/strava/oauth";

export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.redirect(publicUrl("/unlock"), 303);
  }

  const connection = await getConnection(userId);

  if (connection) {
    try {
      const token = await getValidAccessToken(userId);
      if (token) {
        try {
          await deauthorize(token);
        } catch {
          // Best effort: disconnect proceeds even if Strava is unreachable.
        }
      }
    } catch {
      // Best effort: disconnect proceeds even if the token cannot be refreshed.
    }
  }

  await deleteConnection(userId);
  return NextResponse.redirect(publicUrl("/connect"), 303);
}
