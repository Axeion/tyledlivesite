"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createLoginToken } from "@/lib/auth/login-token";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { canUseTemplate } from "@/lib/entitlements";
import { checkSignupRateLimit, getClientIp } from "@/lib/rate-limit";
import { signupSchema, type SignupInput } from "@/lib/signup-schema";
import { lodgeSubdomainUrl } from "@/lib/urls";
import { RESERVED_SLUGS, slugSchema, zodMessage } from "@/lib/validation";
import { getTemplate } from "@/templates/registry";

interface SignupResult {
  ok: boolean;
  error?: string;
  redirectTo?: string;
}

/**
 * Creates the account, the lodge (PENDING_REVIEW) and the admin membership,
 * then hands the user off to their new subdomain's dashboard.
 */
export async function submitSignup(input: SignupInput): Promise<SignupResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: zodMessage(parsed.error) };
  const data = parsed.data;

  const ip = getClientIp(await headers());
  const limit = await checkSignupRateLimit(ip);
  if (!limit.allowed) {
    return { ok: false, error: `Too many signups from your network. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.` };
  }

  if (RESERVED_SLUGS.has(data.slug)) return { ok: false, error: "That subdomain is reserved" };
  const template = getTemplate(data.templateId);
  // New lodges start on the free plan; enforce the template entitlement here too.
  if (!canUseTemplate({ plan: "FREE" }, template)) return { ok: false, error: "That template requires a paid plan" };

  const existingUser = await db.user.findUnique({ where: { email: data.account.email } });
  if (existingUser) return { ok: false, error: "An account with that email already exists. Sign in instead." };
  const existingSlug = await db.lodge.findUnique({ where: { slug: data.slug } });
  if (existingSlug) return { ok: false, error: "That subdomain is already taken" };

  const passwordHash = await hashPassword(data.account.password);
  const { lodge, user } = await db.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email: data.account.email, name: data.account.name, passwordHash } });
    const lodge = await tx.lodge.create({
      data: {
        slug: data.slug,
        templateId: template.id,
        status: "PENDING_REVIEW",
        submittedAt: new Date(),
        published: false,
        ...data.lodge,
      },
    });
    await tx.lodgeMembership.create({ data: { userId: user.id, lodgeId: lodge.id, role: "ADMIN" } });
    await tx.auditLog.create({ data: { actorId: user.id, lodgeId: lodge.id, action: "lodge.submitted", meta: { ip } } });
    return { lodge, user };
  });

  const token = await createLoginToken(user.id, lodge.id);
  return { ok: true, redirectTo: lodgeSubdomainUrl(lodge.slug, `/dashboard/auth/exchange?token=${token}`) };
}

/** Availability check used by the wizard while typing. */
export async function checkSlugAvailability(raw: string): Promise<{ slug: string; available: boolean; reason?: string }> {
  const parsed = slugSchema.safeParse(raw);
  if (!parsed.success) return { slug: raw, available: false, reason: parsed.error.issues[0]?.message };
  if (RESERVED_SLUGS.has(parsed.data)) return { slug: parsed.data, available: false, reason: "Reserved" };
  const exists = await db.lodge.findUnique({ where: { slug: parsed.data }, select: { id: true } });
  return { slug: parsed.data, available: !exists, reason: exists ? "Already taken" : undefined };
}

export async function redirectAfterSignup(url: string): Promise<never> {
  redirect(url);
}
