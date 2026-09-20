"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createLoginToken } from "@/lib/auth/login-token";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { getDashboardLodge } from "@/lib/dashboard";
import { db } from "@/lib/db";
import { getClientIp, isLoginBlocked, recordFailedLogin } from "@/lib/rate-limit";
import { lodgeSubdomainUrl } from "@/lib/urls";
import { emailSchema, formString } from "@/lib/validation";
import type { ActionResult } from "@/components/ActionForm";
import type { User } from "@/generated/prisma/client";

const BAD_CREDENTIALS = "Email or password is incorrect";
const LOCKED = "Too many failed sign-in attempts. Try again in 15 minutes.";

type AuthOutcome = { user: User } | { error: string };

/** Verifies credentials with per-IP and per-email lockout on repeated failures. */
async function authenticate(formData: FormData): Promise<AuthOutcome> {
  const email = emailSchema.safeParse(formString(formData, "email") ?? "");
  const password = formString(formData, "password") ?? "";
  if (!email.success || !password) return { error: BAD_CREDENTIALS };
  const ip = getClientIp(await headers());
  if (await isLoginBlocked(ip, email.data)) return { error: LOCKED };
  const user = await db.user.findUnique({ where: { email: email.data } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    const limit = await recordFailedLogin(ip, email.data);
    return { error: limit.allowed ? BAD_CREDENTIALS : LOCKED };
  }
  return { user };
}

/** Login on a lodge subdomain: user must be a member of that lodge. */
export async function loginToLodge(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const lodge = await getDashboardLodge();
  const auth = await authenticate(formData);
  if ("error" in auth) return { error: auth.error };
  const { user } = auth;
  const membership = await db.lodgeMembership.findUnique({
    where: { userId_lodgeId: { userId: user.id, lodgeId: lodge.id } },
  });
  if (!membership) return { error: "This account is not a member of this lodge" };
  await createSession(user.id);
  redirect("/dashboard");
}

/**
 * Login on the apex domain: finds the user's lodge and hands them off to that
 * lodge's subdomain with a one-time token (cookies are host-scoped).
 */
export async function loginFromApex(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const auth = await authenticate(formData);
  if ("error" in auth) return { error: auth.error };
  const { user } = auth;
  if (user.platformRole === "PLATFORM_ADMIN") {
    await createSession(user.id);
    redirect("/admin");
  }
  const memberships = await db.lodgeMembership.findMany({ where: { userId: user.id }, include: { lodge: true } });
  if (memberships.length === 0) return { error: "This account does not belong to any lodge yet" };
  const requested = formString(formData, "lodgeId");
  const target = memberships.find((m) => m.lodgeId === requested) ?? memberships[0];
  const token = await createLoginToken(user.id, target.lodgeId);
  redirect(lodgeSubdomainUrl(target.lodge.slug, `/dashboard/auth/exchange?token=${token}`));
}

export async function adminLogin(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const auth = await authenticate(formData);
  if ("error" in auth) return { error: auth.error };
  if (auth.user.platformRole !== "PLATFORM_ADMIN") return { error: BAD_CREDENTIALS };
  const { user } = auth;
  await createSession(user.id);
  redirect("/admin");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}

export async function logoutFromDashboard(): Promise<void> {
  await destroySession();
  redirect("/dashboard/login");
}
