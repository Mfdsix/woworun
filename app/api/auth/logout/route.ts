import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const response = NextResponse.redirect(new URL("/unlock", request.url), 303);
  clearSessionCookie(response);
  return response;
}
