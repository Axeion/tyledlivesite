import type { Plan } from "@/generated/prisma/enums";

/**
 * Central entitlements module. Every feature gate in the app (custom domains,
 * template tiers, TLS issuance, tenant resolution) calls one of the functions
 * here, so plan rules live in exactly one place.
 */

export type TemplateTier = "free" | "premium";

export interface PlanFeatures {
  customDomain: boolean;
  premiumTemplates: boolean;
}

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  FREE: { customDomain: false, premiumTemplates: false },
  PAID: { customDomain: true, premiumTemplates: true },
};

/** Subscription states in which the paid plan no longer applies at all. */
export const LAPSED_STATUSES = new Set(["canceled", "unpaid", "incomplete_expired", "incomplete"]);

/** Days a `past_due` subscription keeps its paid features while Stripe retries payment. */
export const PAST_DUE_GRACE_DAYS = 7;

export interface EntitlementSubject {
  plan: Plan;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: Date | null;
}

/**
 * The plan a lodge is actually entitled to right now. The stored `plan` column
 * is updated by Stripe webhooks, but this also guards against stale rows
 * (e.g. a missed webhook) by looking at the subscription state.
 */
export function effectivePlan(lodge: EntitlementSubject, now: Date = new Date()): Plan {
  if (lodge.plan !== "PAID") return "FREE";
  const status = lodge.subscriptionStatus ?? "active";
  if (LAPSED_STATUSES.has(status)) return "FREE";
  if (status === "past_due" && lodge.currentPeriodEnd) {
    const graceEnd = new Date(lodge.currentPeriodEnd.getTime() + PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000);
    if (now > graceEnd) return "FREE";
  }
  return "PAID";
}

export function featuresFor(lodge: EntitlementSubject, now?: Date): PlanFeatures {
  return PLAN_FEATURES[effectivePlan(lodge, now)];
}

export function canUseCustomDomain(lodge: EntitlementSubject, now?: Date): boolean {
  return featuresFor(lodge, now).customDomain;
}

export function canUseTemplate(lodge: EntitlementSubject, template: { tier: TemplateTier }, now?: Date): boolean {
  if (template.tier === "free") return true;
  return featuresFor(lodge, now).premiumTemplates;
}
