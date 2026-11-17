import { createHmac, timingSafeEqual } from "node:crypto";

const STATE_TTL_MS = 10 * 60 * 1000;
const KEY_CONTEXT = "wl-oauth-state:v1";

type StatePayload = {
  uid: string;
  nonce: string;
  exp: number;
};

export type StateCheck =
  | { ok: true; userId: string; nonce: string }
  | { ok: false };

function stateKey(secret: string): Buffer {
  return Buffer.from(createHmac("sha256", secret).update(KEY_CONTEXT).digest("hex"), "utf8");
}

function sign(payloadPart: string, secret: string): string {
  return createHmac("sha256", stateKey(secret)).update(payloadPart).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function isStatePayload(value: unknown): value is StatePayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.uid === "string" &&
    candidate.uid.length > 0 &&
    typeof candidate.nonce === "string" &&
    candidate.nonce.length > 0 &&
    typeof candidate.exp === "number" &&
    Number.isFinite(candidate.exp)
  );
}

export function createOAuthState(
  userId: string,
  nonce: string,
  secret: string,
  now = Date.now(),
): string {
  const payload: StatePayload = {
    uid: userId,
    nonce,
    exp: now + STATE_TTL_MS,
  };
  const payloadPart = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${payloadPart}.${sign(payloadPart, secret)}`;
}

export function verifyOAuthState(
  state: string,
  secret: string,
  now = Date.now(),
): StateCheck {
  if (typeof state !== "string" || state.length === 0) {
    return { ok: false };
  }

  const parts = state.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false };
  }

  const [payloadPart, signaturePart] = parts;
  if (!safeEqual(signaturePart, sign(payloadPart, secret))) {
    return { ok: false };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
  } catch {
    return { ok: false };
  }

  if (!isStatePayload(decoded)) {
    return { ok: false };
  }

  if (now >= decoded.exp) {
    return { ok: false };
  }

  return { ok: true, userId: decoded.uid, nonce: decoded.nonce };
}
