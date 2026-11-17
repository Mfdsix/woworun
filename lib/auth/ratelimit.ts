import { prisma } from "@/lib/db";

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<RateLimitResult> {
  const bucket = await prisma.rateBucket.findUnique({ where: { key } });

  if (!bucket || now - bucket.windowStart.getTime() >= windowMs) {
    const windowStart = new Date(now);
    await prisma.rateBucket.upsert({
      where: { key },
      create: { key, count: 1, windowStart },
      update: { count: 1, windowStart },
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    const remainingMs = bucket.windowStart.getTime() + windowMs - now;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
    };
  }

  await prisma.rateBucket.update({
    where: { key },
    data: { count: { increment: 1 } },
  });

  return { allowed: true, retryAfterSeconds: 0 };
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = headers.get("x-real-ip");
  if (realIp && realIp.trim()) return realIp.trim();

  return "unknown";
}
