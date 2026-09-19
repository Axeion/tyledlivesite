import { db } from "@/lib/db";
import { env } from "@/lib/env";

/** Best-effort client IP. Only trusts X-Forwarded-For when TRUST_PROXY=1. */
export function getClientIp(headers: Headers): string {
  if (env.trustProxy) {
    const xff = headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    const real = headers.get("x-real-ip");
    if (real) return real.trim();
  }
  return headers.get("x-client-ip")?.trim() || "unknown";
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * DB-backed sliding-window limiter for signups so it behaves correctly across
 * multiple app instances without Redis. Records an attempt when allowed.
 */
export async function checkSignupRateLimit(ip: string, now: Date = new Date()): Promise<RateLimitResult> {
  const limit = env.signup.maxPerHour;
  const windowStart = new Date(now.getTime() - 60 * 60 * 1000);
  const recent = await db.signupAttempt.findMany({
    where: { ip, createdAt: { gte: windowStart } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  if (recent.length >= limit) {
    const oldest = recent[0].createdAt.getTime();
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + 60 * 60 * 1000 - now.getTime()) / 1000));
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }
  await db.signupAttempt.create({ data: { ip, createdAt: now } });
  return { allowed: true, remaining: limit - recent.length - 1, retryAfterSeconds: 0 };
}

/** Housekeeping: drop attempts older than a day (called by the worker). */
export async function pruneSignupAttempts(): Promise<number> {
  const res = await db.signupAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  return res.count;
}
