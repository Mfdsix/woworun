import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/session";
import { importManualItems } from "@/lib/manual/activities";

export const runtime = "nodejs";

const walkSchema = z.object({
  id: z.string(),
  name: z.string(),
  startLocal: z.string(),
  distanceM: z.number(),
  movingTimeS: z.number(),
  elapsedTimeS: z.number(),
});

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        walk: walkSchema,
        points: z.number(),
      }),
    )
    .min(1)
    .max(1000),
});

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const result = await importManualItems(userId, parsed.data.items);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("manual_activities_import_failed", error);
    return NextResponse.json({ error: "Could not import activities." }, { status: 500 });
  }
}
