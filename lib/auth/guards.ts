import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import type { Lodge, LodgeMembership, User } from "@/generated/prisma/client";
import type { LodgeRole } from "@/generated/prisma/enums";

export class AuthorizationError extends Error {
  constructor(message = "Not authorized") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** Roles ordered by privilege; ADMIN implies EDITOR. */
const ROLE_RANK: Record<LodgeRole, number> = { EDITOR: 1, ADMIN: 2 };

export function roleSatisfies(actual: LodgeRole, required: LodgeRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export async function requirePlatformAdmin(opts: { redirectTo?: string } = {}): Promise<User> {
  const user = await getCurrentUser();
  if (!user || user.platformRole !== "PLATFORM_ADMIN") {
    if (opts.redirectTo) redirect(opts.redirectTo);
    throw new AuthorizationError("Platform admin required");
  }
  return user;
}

export interface LodgeActor {
  user: User;
  membership: LodgeMembership;
  lodge: Lodge;
}

/**
 * Ensures the current user is a member of `lodge` with at least `role`.
 * Platform admins are NOT implicitly lodge members; they act via /admin.
 */
export async function requireLodgeRole(
  lodge: Lodge,
  role: LodgeRole,
  opts: { redirectTo?: string } = {},
): Promise<LodgeActor> {
  const user = await getCurrentUser();
  if (!user) {
    if (opts.redirectTo) redirect(opts.redirectTo);
    throw new AuthorizationError("Sign in required");
  }
  const membership = await db.lodgeMembership.findUnique({
    where: { userId_lodgeId: { userId: user.id, lodgeId: lodge.id } },
  });
  if (!membership || !roleSatisfies(membership.role, role)) {
    throw new AuthorizationError(`Lodge ${role.toLowerCase()} role required`);
  }
  return { user, membership, lodge };
}
