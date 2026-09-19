import { describe, expect, it } from "vitest";
import { PAST_DUE_GRACE_DAYS, canUseCustomDomain, canUseTemplate, effectivePlan } from "@/lib/entitlements";
import { TEMPLATES } from "@/templates/registry";

const DAY = 24 * 60 * 60 * 1000;

describe("entitlements", () => {
  it("free plan cannot use custom domains", () => {
    expect(canUseCustomDomain({ plan: "FREE" })).toBe(false);
  });

  it("active paid plan can use custom domains", () => {
    expect(canUseCustomDomain({ plan: "PAID", subscriptionStatus: "active" })).toBe(true);
    expect(canUseCustomDomain({ plan: "PAID", subscriptionStatus: "trialing" })).toBe(true);
    expect(canUseCustomDomain({ plan: "PAID", subscriptionStatus: null })).toBe(true);
  });

  it("lapsed subscriptions fall back to free even if plan column says PAID", () => {
    for (const status of ["canceled", "unpaid", "incomplete_expired", "incomplete"]) {
      expect(effectivePlan({ plan: "PAID", subscriptionStatus: status })).toBe("FREE");
      expect(canUseCustomDomain({ plan: "PAID", subscriptionStatus: status })).toBe(false);
    }
  });

  it("past_due keeps paid features during the grace window only", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const periodEnd = new Date(now.getTime() - 2 * DAY);
    expect(effectivePlan({ plan: "PAID", subscriptionStatus: "past_due", currentPeriodEnd: periodEnd }, now)).toBe("PAID");
    const long = new Date(now.getTime() - (PAST_DUE_GRACE_DAYS + 1) * DAY);
    expect(effectivePlan({ plan: "PAID", subscriptionStatus: "past_due", currentPeriodEnd: long }, now)).toBe("FREE");
  });

  it("free templates are always allowed; premium requires the paid plan", () => {
    const free = { tier: "free" as const };
    const premium = { tier: "premium" as const };
    expect(canUseTemplate({ plan: "FREE" }, free)).toBe(true);
    expect(canUseTemplate({ plan: "FREE" }, premium)).toBe(false);
    expect(canUseTemplate({ plan: "PAID", subscriptionStatus: "active" }, premium)).toBe(true);
    expect(canUseTemplate({ plan: "PAID", subscriptionStatus: "canceled" }, premium)).toBe(false);
  });

  it("every registered template is currently free and selectable on the free plan", () => {
    expect(TEMPLATES.length).toBe(3);
    for (const t of TEMPLATES) {
      expect(t.tier).toBe("free");
      expect(canUseTemplate({ plan: "FREE" }, t)).toBe(true);
    }
  });
});
