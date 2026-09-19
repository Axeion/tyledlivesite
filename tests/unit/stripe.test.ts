import Stripe from "stripe";
import { beforeEach, describe, expect, it } from "vitest";
import { constructWebhookEvent, handleStripeEvent, planForStatus } from "@/lib/billing/stripe";
import { db } from "@/lib/db";
import { canUseCustomDomain } from "@/lib/entitlements";
import { makeLodge, resetDatabase } from "./helpers";

let seq = 0;
function subscriptionEvent(type: Stripe.Event.Type, sub: Partial<Stripe.Subscription> & { id: string; customer: string; status: string }): Stripe.Event {
  seq += 1;
  return {
    id: `evt_${seq}`,
    object: "event",
    type,
    data: { object: { object: "subscription", items: { data: [{ current_period_end: 1_800_000_000 }] }, metadata: {}, ...sub } },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    api_version: "2026-01-01",
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event;
}

describe("stripe webhook handling", () => {
  beforeEach(resetDatabase);

  it("maps subscription statuses to plans", () => {
    expect(planForStatus("active")).toBe("PAID");
    expect(planForStatus("trialing")).toBe("PAID");
    expect(planForStatus("past_due")).toBe("PAID");
    expect(planForStatus("canceled")).toBe("FREE");
    expect(planForStatus("unpaid")).toBe("FREE");
    expect(planForStatus(null)).toBe("FREE");
  });

  it("upgrades a lodge when its subscription becomes active, then downgrades on deletion", async () => {
    const lodge = await makeLodge({ stripeCustomerId: "cus_1" });
    expect(canUseCustomDomain(lodge)).toBe(false);

    await handleStripeEvent(subscriptionEvent("customer.subscription.created", { id: "sub_1", customer: "cus_1", status: "active" }));
    let updated = await db.lodge.findUniqueOrThrow({ where: { id: lodge.id } });
    expect(updated.plan).toBe("PAID");
    expect(updated.stripeSubscriptionId).toBe("sub_1");
    expect(updated.currentPeriodEnd?.toISOString()).toBe(new Date(1_800_000_000 * 1000).toISOString());
    expect(canUseCustomDomain(updated)).toBe(true);

    await handleStripeEvent(subscriptionEvent("customer.subscription.deleted", { id: "sub_1", customer: "cus_1", status: "canceled" }));
    updated = await db.lodge.findUniqueOrThrow({ where: { id: lodge.id } });
    expect(updated.plan).toBe("FREE");
    expect(updated.subscriptionStatus).toBe("canceled");
    expect(canUseCustomDomain(updated)).toBe(false);
  });

  it("matches lodges by metadata.lodgeId when the customer is unknown", async () => {
    const lodge = await makeLodge();
    await handleStripeEvent(
      subscriptionEvent("customer.subscription.updated", { id: "sub_2", customer: "cus_new", status: "active", metadata: { lodgeId: lodge.id } }),
    );
    const updated = await db.lodge.findUniqueOrThrow({ where: { id: lodge.id } });
    expect(updated.plan).toBe("PAID");
    expect(updated.stripeCustomerId).toBe("cus_new");
  });

  it("is idempotent per event id and ignores unrelated events", async () => {
    const lodge = await makeLodge({ stripeCustomerId: "cus_3" });
    const ev = subscriptionEvent("customer.subscription.created", { id: "sub_3", customer: "cus_3", status: "active" });
    expect(await handleStripeEvent(ev)).toBe(true);
    expect(await handleStripeEvent(ev)).toBe(false);
    const other = { ...ev, id: "evt_other", type: "product.created" } as Stripe.Event;
    expect(await handleStripeEvent(other)).toBe(false);
    expect(await db.stripeEvent.count()).toBe(2);
    expect((await db.lodge.findUniqueOrThrow({ where: { id: lodge.id } })).plan).toBe("PAID");
  });

  it("verifies webhook signatures", () => {
    const payload = JSON.stringify({ id: "evt_sig", object: "event", type: "product.created", data: { object: {} } });
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_unit_test" });
    expect(constructWebhookEvent(payload, header).id).toBe("evt_sig");
    const bad = Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_wrong" });
    expect(() => constructWebhookEvent(payload, bad)).toThrow();
  });
});
