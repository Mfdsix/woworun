import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { isValidPinFormat, normalizePin, pinLookup } from "@/lib/auth/pin";
import { clientIp, consumeRateLimit } from "@/lib/auth/ratelimit";
import { attachSessionCookie, createSessionToken } from "@/lib/auth/session";
import { loginWithPin } from "@/lib/auth/users";

export const runtime = "nodejs";

const IP_LIMIT = 10;
const IP_WINDOW_MS = 15 * 60 * 1000;
const PIN_LIMIT = 30;
const PIN_WINDOW_MS = 60 * 60 * 1000;

const bodySchema = z.object({
  pin: z.string(),
  confirm: z.boolean().optional(),
});

function respond(
  body: Record<string, unknown>,
  status: number,
  headers?: Record<string, string>,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return respond({ error: "Invalid request body." }, 400);
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return respond({ error: "Invalid request body." }, 400);
  }

  const pin = normalizePin(parsed.data.pin);
  if (!isValidPinFormat(pin)) {
    return respond({ error: "PIN must be 6 letters or numbers." }, 400);
  }

  const env = getEnv();

  const ipLimit = await consumeRateLimit(
    `login:ip:${clientIp(request.headers)}`,
    IP_LIMIT,
    IP_WINDOW_MS,
  );
  if (!ipLimit.allowed) {
    return respond(
      { error: "Too many attempts. Try again later." },
      429,
      { "Retry-After": String(ipLimit.retryAfterSeconds) },
    );
  }

  const pinLimit = await consumeRateLimit(
    `login:pin:${pinLookup(env.APP_SECRET, pin)}`,
    PIN_LIMIT,
    PIN_WINDOW_MS,
  );
  if (!pinLimit.allowed) {
    return respond(
      { error: "Too many attempts. Try again later." },
      429,
      { "Retry-After": String(pinLimit.retryAfterSeconds) },
    );
  }

  const result = await loginWithPin(
    env.APP_SECRET,
    pin,
    parsed.data.confirm === true,
    env.MAX_USERS,
  );

  if (result.kind === "ok") {
    const response = respond({ ok: true }, 200);
    attachSessionCookie(response, createSessionToken(result.userId, env.APP_SECRET));
    return response;
  }

  if (result.kind === "needs_confirm") {
    return respond({ needsConfirm: true }, 202);
  }

  if (result.kind === "wrong_pin") {
    return respond({ error: "Wrong PIN." }, 401);
  }

  return respond({ error: "This app is full. No new PIN spaces can be created." }, 409);
}
