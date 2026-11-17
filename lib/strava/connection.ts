import type { StravaConnection } from "@prisma/client";
import { open, seal } from "@/lib/crypto/secret-box";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { refreshAccessToken, type StravaTokenResponse } from "./oauth";

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export function getConnection(userId: string): Promise<StravaConnection | null> {
  return prisma.stravaConnection.findUnique({ where: { userId } });
}

export async function saveConnection(
  userId: string,
  token: StravaTokenResponse,
  scope: string,
): Promise<void> {
  const athlete = token.athlete;
  if (!athlete || typeof athlete.id !== "number") {
    throw new Error("strava_athlete_missing");
  }

  const secret = getEnv().APP_SECRET;
  const nameParts = [athlete.firstname?.trim(), athlete.lastname?.trim()].filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );
  const athleteName = nameParts.length > 0 ? nameParts.join(" ") : null;
  const avatarUrl =
    athlete.profile && athlete.profile.trim().length > 0 ? athlete.profile : null;

  const data = {
    athleteId: BigInt(athlete.id),
    athleteName,
    avatarUrl,
    scope,
    refreshTokenEnc: seal(token.refresh_token, secret, userId),
    accessTokenEnc: seal(token.access_token, secret, userId),
    accessExpiresAt: new Date(token.expires_at * 1000),
    status: "active",
  };

  await prisma.stravaConnection.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

export async function markNeedsReauth(userId: string): Promise<void> {
  await prisma.stravaConnection.update({
    where: { userId },
    data: { status: "needs_reauth" },
  });
}

async function updateTokens(
  userId: string,
  token: StravaTokenResponse,
  scope: string,
): Promise<void> {
  const secret = getEnv().APP_SECRET;
  await prisma.stravaConnection.update({
    where: { userId },
    data: {
      scope,
      refreshTokenEnc: seal(token.refresh_token, secret, userId),
      accessTokenEnc: seal(token.access_token, secret, userId),
      accessExpiresAt: new Date(token.expires_at * 1000),
      status: "active",
    },
  });
}

export async function deleteConnection(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.stravaConnection.deleteMany({ where: { userId } }),
    prisma.dashboardSnapshot.deleteMany({ where: { userId } }),
  ]);
}

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const connection = await getConnection(userId);
  if (!connection || connection.status !== "active") return null;

  const secret = getEnv().APP_SECRET;

  if (
    connection.accessTokenEnc &&
    connection.accessExpiresAt &&
    connection.accessExpiresAt.getTime() > Date.now() + REFRESH_MARGIN_MS
  ) {
    return open(connection.accessTokenEnc, secret, userId);
  }

  const env = getEnv();

  try {
    const token = await refreshAccessToken({
      clientId: env.STRAVA_CLIENT_ID,
      clientSecret: env.STRAVA_CLIENT_SECRET,
      refreshToken: open(connection.refreshTokenEnc, secret, userId),
    });

    await updateTokens(userId, token, token.scope ?? connection.scope);
    return token.access_token;
  } catch (error) {
    if (error instanceof Error && error.message === "strava_invalid_grant") {
      await markNeedsReauth(userId);
      return null;
    }
    throw error;
  }
}
