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
 * DB-backed sliding-window limiter so it behaves correctly across multiple
 * app instances without Redis. Records a hit when allowed.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const windowStart = new Date(now.getTime() - windowMs);
  const recent = await db.rateLimitHit.findMany({
    where: { key, createdAt: { gte: windowStart } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  if (recent.length >= limit) {
    const oldest = recent[0].createdAt.getTime();
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now.getTime()) / 1000));
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }
  await db.rateLimitHit.create({ data: { key, createdAt: now } });
  return { allowed: true, remaining: limit - recent.length - 1, retryAfterSeconds: 0 };
}

const HOUR = 60 * 60 * 1000;

/** Signups: SIGNUP_MAX_PER_HOUR (default 5) per client IP. */
export function checkSignupRateLimit(ip: string, now?: Date): Promise<RateLimitResult> {
  return checkRateLimit(`signup:${ip}`, env.signup.maxPerHour, HOUR, now);
}

export const LOGIN_MAX_PER_IP = 30;
export const LOGIN_MAX_PER_EMAIL = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** Failed logins: per IP and per email address, 15-minute window. Call only after a failed attempt. */
export async function recordFailedLogin(ip: string, email: string, now?: Date): Promise<RateLimitResult> {
  const byIp = await checkRateLimit(`login:ip:${ip}`, LOGIN_MAX_PER_IP, LOGIN_WINDOW_MS, now);
  const byEmail = await checkRateLimit(`login:email:${email}`, LOGIN_MAX_PER_EMAIL, LOGIN_WINDOW_MS, now);
  return byIp.allowed && byEmail.allowed ? byIp : byIp.allowed ? byEmail : byIp;
}

/** True when this IP/email pair is currently locked out (does not record a hit). */
export async function isLoginBlocked(ip: string, email: string, now: Date = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - LOGIN_WINDOW_MS);
  const [ipHits, emailHits] = await Promise.all([
    db.rateLimitHit.count({ where: { key: `login:ip:${ip}`, createdAt: { gte: since } } }),
    db.rateLimitHit.count({ where: { key: `login:email:${email}`, createdAt: { gte: since } } }),
  ]);
  return ipHits >= LOGIN_MAX_PER_IP || emailHits >= LOGIN_MAX_PER_EMAIL;
}

/** Housekeeping: drop hits older than a day (called by the worker). */
export async function pruneRateLimitHits(): Promise<number> {
  const res = await db.rateLimitHit.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 24 * HOUR) } },
  });
  return res.count;
}
