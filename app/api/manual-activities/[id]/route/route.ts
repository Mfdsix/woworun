import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import {
  loadRoute,
  removeRoute,
  routeBodySchema,
  saveRoute,
} from "@/lib/manual/routes";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = { params: Promise<{ id: string }> };

function unauthorized(): Promise<NextResponse> {
  return Promise.resolve(
    NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
  );
}

function invalidId(): NextResponse {
  return NextResponse.json({ error: "Invalid activity id." }, { status: 400 });
}

export async function GET(
  _request: Request,
  { params }: Params,
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!UUID_RE.test(id)) return invalidId();

  try {
    const route = await loadRoute(userId, id);
    if (!route) {
      return NextResponse.json({ error: "Route not found." }, { status: 404 });
    }
    return NextResponse.json(
      { points: route.points, pointCount: route.pointCount },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("route_load_failed", error);
    return NextResponse.json({ error: "Could not load the route." }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: Params,
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!UUID_RE.test(id)) return invalidId();

  const body = await request.json().catch(() => null);
  const parsed = routeBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Route must contain 2-2000 [lat, lng, seconds] points." },
      { status: 400 },
    );
  }

  try {
    const route = await saveRoute(userId, id, parsed.data.points);
    if (!route) {
      return NextResponse.json({ error: "Activity not found." }, { status: 404 });
    }
    return NextResponse.json(
      { pointCount: route.pointCount },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("route_save_failed", error);
    return NextResponse.json({ error: "Could not save the route." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: Params,
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!UUID_RE.test(id)) return invalidId();

  try {
    const removed = await removeRoute(userId, id);
    if (!removed) {
      return NextResponse.json({ error: "Route not found." }, { status: 404 });
    }
    return NextResponse.json(
      { removed: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("route_delete_failed", error);
    return NextResponse.json({ error: "Could not delete the route." }, { status: 500 });
  }
}
