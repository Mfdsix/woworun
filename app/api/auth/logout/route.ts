import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { publicUrl } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.redirect(publicUrl("/unlock"), 303);
  clearSessionCookie(response);
  return response;
}
