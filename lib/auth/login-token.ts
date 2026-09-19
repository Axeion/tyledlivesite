import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/auth/tokens";

const LOGIN_TOKEN_TTL_MS = 5 * 60 * 1000;

/**
 * One-time token that lets a user who just signed up on the apex domain be
 * signed in on their lodge subdomain (session cookies are host-scoped).
 */
export async function createLoginToken(userId: string, lodgeId: string): Promise<string> {
  const raw = randomToken(32);
  await db.loginToken.create({
    data: { tokenHash: sha256(raw), userId, lodgeId, expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MS) },
  });
  return raw;
}

/** Consumes a token. Returns the user/lodge ids or null if invalid, used or expired. */
export async function consumeLoginToken(raw: string, lodgeId: string): Promise<{ userId: string } | null> {
  if (!raw || raw.length > 200) return null;
  const tokenHash = sha256(raw);
  const result = await db.loginToken.updateMany({
    where: { tokenHash, lodgeId, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (result.count !== 1) return null;
  const token = await db.loginToken.findUnique({ where: { tokenHash } });
  return token ? { userId: token.userId } : null;
}
