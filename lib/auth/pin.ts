import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export const PIN_LENGTH = 6;

const PIN_PATTERN = /^[A-Z0-9]{6}$/;
const SCRYPT_KEY_LENGTH = 32;
const SALT_BYTES = 16;
const HASH_PREFIX = "scrypt";
const HEX_PATTERN = /^[0-9a-f]+$/;

function deriveKey(pin: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(pin, salt, SCRYPT_KEY_LENGTH, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(key);
    });
  });
}

export function normalizePin(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, PIN_LENGTH);
}

export function isValidPinFormat(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export function pinLookup(secret: string, pin: string): string {
  return createHmac("sha256", secret).update(`pin-lookup\u0000${pin}`).digest("hex");
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await deriveKey(pin, salt);
  return `${HASH_PREFIX}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3) return false;

  const [prefix, saltHex, hashHex] = parts;
  if (prefix !== HASH_PREFIX) return false;
  if (saltHex.length !== SALT_BYTES * 2 || hashHex.length !== SCRYPT_KEY_LENGTH * 2) return false;
  if (!HEX_PATTERN.test(saltHex) || !HEX_PATTERN.test(hashHex)) return false;

  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = await deriveKey(pin, Buffer.from(saltHex, "hex"));
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
