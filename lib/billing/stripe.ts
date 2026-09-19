import Stripe from "stripe";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { Plan } from "@/generated/prisma/enums";

let stripeClient: Stripe | null = null;

/** Stripe SDK client. STRIPE_API_BASE lets dev/test point at a local mock server. */
export function getStripe(): Stripe {
  if (stripeClient) return stripeClient;
  const config: Stripe.StripeConfig = { typescript: true, maxNetworkRetries: 2 };
  if (env.stripe.apiBase) {
    const u = new URL(env.stripe.apiBase);
    config.host = u.hostname;
    config.port = u.port ? Number(u.port) : u.protocol === "https:" ? 443 : 80;
    config.protocol = u.protocol.replace(":", "") as "http" | "https";
  }
  stripeClient = new Stripe(env.stripe.secretKey, config);
  return stripeClient;
}

/** Statuses that keep the PAID plan. past_due keeps it during the grace window (see entitlements). */
const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

export function planForStatus(status: string | null | undefined): Plan {
  return status && PAID_STATUSES.has(status) ? "PAID" : "FREE";
}

export async function ensureCustomer(lodgeId: string, email: string): Promise<string> {
  const lodge = await db.lodge.findUniqueOrThrow({ where: { id: lodgeId } });
  if (lodge.stripeCustomerId) return lodge.stripeCustomerId;
  const customer = await getStripe().customers.create({
    email,
    name: `${lodge.name} No. ${lodge.number}`,
    metadata: { lodgeId: lodge.id, slug: lodge.slug },
  });
  await db.lodge.update({ where: { id: lodgeId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

export async function createCheckoutSession(opts: {
  lodgeId: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const customerId = await ensureCustomer(opts.lodgeId, opts.email);
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: opts.lodgeId,
    line_items: [{ price: env.stripe.priceId, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    metadata: { lodgeId: opts.lodgeId },
    subscription_data: { metadata: { lodgeId: opts.lodgeId } },
    allow_promotion_codes: true,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

export async function createPortalSession(lodgeId: string, returnUrl: string): Promise<string> {
  const lodge = await db.lodge.findUniqueOrThrow({ where: { id: lodgeId } });
  if (!lodge.stripeCustomerId) throw new Error("Lodge has no billing account yet");
  const session = await getStripe().billingPortal.sessions.create({
    customer: lodge.stripeCustomerId,
    return_url: returnUrl,
  });
  return session.url;
}

function periodEndOf(sub: Stripe.Subscription): Date | null {
  const item = sub.items?.data?.[0];
  const ts = item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  return ts ? new Date(ts * 1000) : null;
}

/** Persist a subscription's state onto the lodge that owns it. */
export async function applySubscription(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const lodgeId = sub.metadata?.lodgeId;
  const lodge = lodgeId
    ? await db.lodge.findUnique({ where: { id: lodgeId } })
    : await db.lodge.findUnique({ where: { stripeCustomerId: customerId } });
  if (!lodge) {
    console.warn(`[stripe] subscription ${sub.id} has no matching lodge (customer ${customerId})`);
    return;
  }
  // Ignore updates about an older subscription once the lodge has a newer one.
  if (lodge.stripeSubscriptionId && lodge.stripeSubscriptionId !== sub.id && sub.status === "canceled") {
    return;
  }
  await db.lodge.update({
    where: { id: lodge.id },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      subscriptionStatus: sub.status,
      currentPeriodEnd: periodEndOf(sub),
      plan: planForStatus(sub.status),
    },
  });
  await db.auditLog.create({
    data: { lodgeId: lodge.id, action: "billing.subscription", meta: { subscriptionId: sub.id, status: sub.status } },
  });
}

/**
 * Handles a verified Stripe event. Idempotent: each event id is processed once.
 * Returns true when the event changed something, false when ignored/duplicate.
 */
export async function handleStripeEvent(event: Stripe.Event, stripe: Stripe = getStripe()): Promise<boolean> {
  const existing = await db.stripeEvent.findUnique({ where: { id: event.id } });
  if (existing) return false;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription) {
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const sub = await stripe.subscriptions.retrieve(subId);
        if (!sub.metadata?.lodgeId && session.client_reference_id) {
          sub.metadata = { ...(sub.metadata ?? {}), lodgeId: session.client_reference_id };
        }
        await applySubscription(sub);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed": {
      await applySubscription(event.data.object as Stripe.Subscription);
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (customerId) {
        const lodge = await db.lodge.findUnique({ where: { stripeCustomerId: customerId } });
        if (lodge) {
          await db.auditLog.create({
            data: { lodgeId: lodge.id, action: "billing.payment_failed", meta: { invoiceId: invoice.id } },
          });
        }
      }
      break;
    }
    default:
      await db.stripeEvent.create({ data: { id: event.id, type: event.type } });
      return false;
  }
  await db.stripeEvent.create({ data: { id: event.id, type: event.type } });
  return true;
}

export function constructWebhookEvent(rawBody: string | Buffer, signature: string): Stripe.Event {
  return getStripe().webhooks.constructEvent(rawBody, signature, env.stripe.webhookSecret);
}
