import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const PREFIX = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_CONTEXT = "strava-token:v1";

function deriveKey(secret: string): Buffer {
  return createHmac("sha256", secret).update(KEY_CONTEXT).digest();
}

export function seal(plaintext: string, secret: string, aad: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function open(sealed: string, secret: string, aad: string): string {
  if (typeof sealed !== "string") throw new Error("bad sealed payload");

  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error("bad sealed payload");
  }

  try {
    const iv = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    const ciphertext = Buffer.from(parts[3], "base64url");

    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
      throw new Error("bad sealed payload");
    }

    const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret), iv);
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("bad sealed payload");
  }
}
