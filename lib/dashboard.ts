import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { tenantDb, type TenantDb } from "@/lib/tenant-db";
import { lodgeSubdomainUrl } from "@/lib/urls";
import { AuthorizationError, roleSatisfies } from "@/lib/auth/guards";
import type { Lodge, LodgeMembership, Prisma, User } from "@/generated/prisma/client";
import type { LodgeRole } from "@/generated/prisma/enums";

export interface DashboardContext {
  lodge: Lodge;
  user: User;
  membership: LodgeMembership;
  db: TenantDb;
}

/** The lodge whose dashboard this host serves. Custom domains never host the dashboard. */
export const getDashboardLodge = cache(async (): Promise<Lodge> => {
  const tenant = await getCurrentTenant();
  if (tenant.kind === "fallback") redirect(lodgeSubdomainUrl(tenant.lodge.slug, "/dashboard"));
  if (tenant.kind !== "lodge") notFound();
  if (tenant.via === "custom") redirect(lodgeSubdomainUrl(tenant.lodge.slug, "/dashboard"));
  return tenant.lodge;
});

/**
 * Resolves the current dashboard actor. Pages call this with `redirect: true`
 * so anonymous users land on the login page; server actions use the default
 * and get an AuthorizationError instead.
 */
export async function requireDashboard(role: LodgeRole = "EDITOR", opts: { redirect?: boolean } = {}): Promise<DashboardContext> {
  const lodge = await getDashboardLodge();
  const user = await getCurrentUser();
  if (!user) {
    if (opts.redirect) redirect("/dashboard/login");
    throw new AuthorizationError("Sign in required");
  }
  const membership = await db.lodgeMembership.findUnique({
    where: { userId_lodgeId: { userId: user.id, lodgeId: lodge.id } },
  });
  if (!membership) {
    if (opts.redirect) redirect("/dashboard/login?error=not-a-member");
    throw new AuthorizationError("You are not a member of this lodge");
  }
  if (!roleSatisfies(membership.role, role)) {
    if (opts.redirect) redirect("/dashboard?error=admin-only");
    throw new AuthorizationError("Lodge admin role required");
  }
  return { lodge, user, membership, db: tenantDb(lodge.id) };
}

export async function audit(ctx: Pick<DashboardContext, "lodge" | "user">, action: string, meta?: Record<string, unknown>) {
  await db.auditLog.create({
    data: { lodgeId: ctx.lodge.id, actorId: ctx.user.id, action, meta: meta as Prisma.InputJsonValue | undefined },
  });
}
