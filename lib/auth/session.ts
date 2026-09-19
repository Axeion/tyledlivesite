import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { randomToken, sha256 } from "@/lib/auth/tokens";
import type { User } from "@/generated/prisma/client";

export const SESSION_COOKIE = "tyled_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Creates a DB-backed session and sets the cookie for the current host.
 * Cookies are deliberately host-scoped (no Domain attribute): a login on
 * the apex does not carry over to lodge subdomains, and vice versa.
 */
export async function createSession(userId: string): Promise<void> {
  const raw = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { id: sha256(raw), userId, expiresAt } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.platformScheme === "https",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (raw) {
    await db.session.deleteMany({ where: { id: sha256(raw) } });
  }
  jar.delete(SESSION_COOKIE);
}

/** Current user for this request, or null. Memoised per request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const session = await db.session.findUnique({ where: { id: sha256(raw) }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return session.user;
});
