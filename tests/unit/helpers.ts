import { db } from "@/lib/db";
import type { Lodge } from "@/generated/prisma/client";

let counter = 0;

export async function resetDatabase(): Promise<void> {
  // Order matters only for tables without cascades; everything hangs off Lodge/User.
  await db.stripeEvent.deleteMany();
  await db.geocodeCache.deleteMany();
  await db.rateLimitHit.deleteMany();
  await db.lodge.deleteMany();
  await db.user.deleteMany();
}

export async function makeLodge(overrides: Partial<Lodge> = {}): Promise<Lodge> {
  counter += 1;
  const slug = overrides.slug ?? `lodge-${counter}-${Date.now().toString(36)}`;
  return db.lodge.create({
    data: {
      slug,
      name: overrides.name ?? `Lodge ${counter}`,
      number: overrides.number ?? String(counter),
      jurisdiction: overrides.jurisdiction ?? "Grand Lodge of Test",
      status: overrides.status ?? "APPROVED",
      published: overrides.published ?? true,
      plan: overrides.plan ?? "FREE",
      subscriptionStatus: overrides.subscriptionStatus ?? null,
      currentPeriodEnd: overrides.currentPeriodEnd ?? null,
      stripeCustomerId: overrides.stripeCustomerId ?? null,
      stripeSubscriptionId: overrides.stripeSubscriptionId ?? null,
      templateId: overrides.templateId ?? "classic",
      timezone: overrides.timezone ?? "America/New_York",
    },
  });
}

export async function makeUser(email: string, platformRole: "PLATFORM_ADMIN" | null = null) {
  return db.user.create({ data: { email, name: email, passwordHash: "x", platformRole } });
}
