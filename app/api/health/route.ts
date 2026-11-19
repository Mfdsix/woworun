import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public liveness/readiness probe used by the deploy script, Docker healthcheck
 * and uptime monitoring. No auth by design: it exposes only liveness, the
 * deployed commit and process uptime.
 */
export async function GET(): Promise<NextResponse> {
  const headers = { "Cache-Control": "no-store" };

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        status: "ok",
        commit: process.env.GIT_COMMIT ?? "unknown",
        uptime: Math.round(process.uptime()),
      },
      { headers },
    );
  } catch (error) {
    console.error("health_db_check_failed", error);
    return NextResponse.json({ status: "db_down" }, { status: 503, headers });
  }
}
