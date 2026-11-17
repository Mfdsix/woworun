import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";

export const SESSION_COOKIE = "wl_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const KEY_CONTEXT = "wl-session-key:v1";

type SessionPayload = {
  t: "session";
  sub: string;
  iat: number;
  exp: number;
};

export type SessionCheck =
  | { ok: true; userId: string }
  | { ok: false; reason: string };

function signingKey(secret: string): Buffer {
  return Buffer.from(createHmac("sha256", secret).update(KEY_CONTEXT).digest("hex"), "utf8");
}

function sign(payloadPart: string, secret: string): string {
  return createHmac("sha256", signingKey(secret)).update(payloadPart).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.t === "session" &&
    typeof candidate.sub === "string" &&
    candidate.sub.length > 0 &&
    typeof candidate.iat === "number" &&
    Number.isFinite(candidate.iat) &&
    typeof candidate.exp === "number" &&
    Number.isFinite(candidate.exp)
  );
}

export function createSessionToken(
  userId: string,
  secret: string,
  now = Date.now(),
): string {
  const payload: SessionPayload = {
    t: "session",
    sub: userId,
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const payloadPart = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${payloadPart}.${sign(payloadPart, secret)}`;
}

export function verifySessionToken(
  token: string,
  secret: string,
  now = Date.now(),
): SessionCheck {
  if (typeof token !== "string" || token.length === 0) {
    return { ok: false, reason: "malformed" };
  }

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, reason: "malformed" };
  }

  const [payloadPart, signaturePart] = parts;
  const expected = sign(payloadPart, secret);
  if (!safeEqual(signaturePart, expected)) {
    return { ok: false, reason: "bad_signature" };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (!isSessionPayload(decoded)) {
    return { ok: false, reason: "malformed" };
  }

  if (now >= decoded.exp) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, userId: decoded.sub };
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const result = verifySessionToken(token, getEnv().APP_SECRET);
  if (!result.ok) return null;

  const user = await prisma.user.findFirst({
    where: { id: result.userId, isActive: true },
    select: { id: true },
  });

  return user?.id ?? null;
}

export function attachSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
