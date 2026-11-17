import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/session";
import {
  addManualText,
  clearManualActivities,
} from "@/lib/manual/activities";

export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().trim().min(1).max(20000),
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
    const result = await addManualText(userId, parsed.data.text);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("manual_activities_add_failed", error);
    return NextResponse.json({ error: "Could not save activities." }, { status: 500 });
  }
}

export async function DELETE(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const deleted = await clearManualActivities(userId);
    return NextResponse.json({ deleted }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("manual_activities_clear_failed", error);
    return NextResponse.json({ error: "Could not clear activities." }, { status: 500 });
  }
}
