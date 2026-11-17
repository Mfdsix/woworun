import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getConnection } from "@/lib/strava/connection";
import { getDashboard } from "@/lib/strava/sync";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const connection = await getConnection(userId);
  if (!connection) {
    return NextResponse.json({ error: "No Strava connection." }, { status: 404 });
  }

  const result = await getDashboard(userId);

  const body = {
    exportedAt: new Date().toISOString(),
    athlete: {
      id: connection.athleteId.toString(),
      name: connection.athleteName,
    },
    connection: {
      status: connection.status,
      connectedAt: connection.connectedAt.toISOString(),
    },
    dashboard: result.data,
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="walk-log-export.json"',
      "Cache-Control": "no-store",
    },
  });
}
