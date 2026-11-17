/**
 * Local demo seed: creates a PIN space with a cached dashboard snapshot,
 * so the full UI can be tested without Strava credentials.
 *
 * Run: set -a; source .env; set +a; npx tsx scripts/seed-demo.ts
 *
 * The snapshot expires after 1 hour. Refreshing after that will fail until
 * real Strava credentials are configured — this is a UI test only.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { hashPin, pinLookup } from "../lib/auth/pin";
import { buildDashboard } from "../lib/strava/metrics";
import type { WalkSession } from "../lib/strava/types";

const PIN = "WALK01";
const DEMO_ATHLETE_ID = 900000001n;

const walks: WalkSession[] = [
  { id: "1", name: "Easy 6k", startLocal: "2026-11-16T16:54:00Z", distanceM: 7070, movingTimeS: 4860, elapsedTimeS: 4920 },
  { id: "2", name: "3rd 5k", startLocal: "2026-11-12T16:45:00Z", distanceM: 5470, movingTimeS: 4140, elapsedTimeS: 4200 },
  { id: "3", name: "2nd 5k", startLocal: "2026-11-09T17:05:00Z", distanceM: 5250, movingTimeS: 3480, elapsedTimeS: 3480 },
  { id: "4", name: "5k?", startLocal: "2026-11-06T16:54:00Z", distanceM: 5550, movingTimeS: 3780, elapsedTimeS: 3780 },
  { id: "5", name: "Amjay 4k", startLocal: "2026-11-04T17:02:00Z", distanceM: 4700, movingTimeS: 3060, elapsedTimeS: 3120 },
  { id: "6", name: "Strava", startLocal: "2026-11-02T16:50:00Z", distanceM: 3850, movingTimeS: 2700, elapsedTimeS: 2760 },
];

const prisma = new PrismaClient();

async function main() {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error("APP_SECRET missing");

  const lookup = pinLookup(secret, PIN);
  const existing = await prisma.user.findUnique({ where: { pinLookup: lookup } });

  const user =
    existing ??
    (await prisma.user.create({
      data: { pinLookup: lookup, pinHash: await hashPin(PIN) },
    }));

  const now = new Date();
  const data = buildDashboard(walks, now);

  await prisma.stravaConnection.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      athleteId: DEMO_ATHLETE_ID,
      athleteName: "Jakarta Walker (demo)",
      scope: "read,activity:read_all",
      refreshTokenEnc: "demo",
      accessTokenEnc: "demo",
      accessExpiresAt: new Date(0),
      status: "active",
    },
    update: {
      athleteName: "Jakarta Walker (demo)",
      status: "active",
    },
  });

  await prisma.dashboardSnapshot.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      payload: data as unknown as Prisma.InputJsonValue,
      computedAt: now,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    },
    update: {
      payload: data as unknown as Prisma.InputJsonValue,
      computedAt: now,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    },
  });

  console.log(`seeded pin=${PIN} userId=${user.id} km=${(data.month.distanceM / 1000).toFixed(1)}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
