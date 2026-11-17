import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { clearSessionCookie, getSessionUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { publicUrl } from "@/lib/http";
import { getConnection, getValidAccessToken } from "@/lib/strava/connection";
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
          // Best effort: deletion proceeds even if Strava deauthorization fails.
        }
      }
    } catch {
      // Best effort: deletion proceeds even if the token cannot be refreshed.
    }
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2025") {
      throw error;
    }
  }

  const response = NextResponse.redirect(publicUrl("/unlock"), 303);
  clearSessionCookie(response);
  return response;
}
