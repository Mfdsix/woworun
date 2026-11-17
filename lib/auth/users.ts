import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPin, pinLookup, verifyPin } from "./pin";

export type LoginResult =
  | { kind: "ok"; userId: string }
  | { kind: "needs_confirm" }
  | { kind: "wrong_pin" }
  | { kind: "limit_reached" };

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

export async function loginWithPin(
  secret: string,
  pin: string,
  confirm: boolean,
  maxUsers: number,
): Promise<LoginResult> {
  const lookup = pinLookup(secret, pin);
  const existing = await prisma.user.findUnique({ where: { pinLookup: lookup } });

  if (existing) {
    const matches = await verifyPin(pin, existing.pinHash);
    return matches ? { kind: "ok", userId: existing.id } : { kind: "wrong_pin" };
  }

  if (!confirm) {
    return { kind: "needs_confirm" };
  }

  const activeUsers = await prisma.user.count({ where: { isActive: true } });
  if (activeUsers >= maxUsers) {
    return { kind: "limit_reached" };
  }

  const pinHash = await hashPin(pin);

  try {
    const created = await prisma.user.create({
      data: { pinLookup: lookup, pinHash },
    });
    return { kind: "ok", userId: created.id };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;

    const raced = await prisma.user.findUnique({ where: { pinLookup: lookup } });
    if (!raced) return { kind: "wrong_pin" };

    const matches = await verifyPin(pin, raced.pinHash);
    return matches ? { kind: "ok", userId: raced.id } : { kind: "wrong_pin" };
  }
}
