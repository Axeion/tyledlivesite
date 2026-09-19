import { openBillingPortal, startCheckout } from "@/lib/actions/lodge";
import { requireDashboard } from "@/lib/dashboard";
import { effectivePlan } from "@/lib/entitlements";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string; already?: string }> }) {
  const { lodge } = await requireDashboard("ADMIN", { redirect: true });
  const { checkout, already } = await searchParams;
  const plan = effectivePlan(lodge);
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Billing</h2>
      {checkout === "success" ? (
        <p className="alert-success" data-testid="checkout-success">
          Thanks! Your subscription is being activated. This page updates as soon as Stripe confirms payment.
        </p>
      ) : null}
      {checkout === "cancelled" ? <p className="alert-info">Checkout cancelled. No changes were made.</p> : null}
      {already ? <p className="alert-info">You already have an active subscription.</p> : null}

      <section className="card">
        <h3 className="font-semibold">Current plan</h3>
        <p className="mt-1 text-2xl font-bold" data-testid="plan-label">
          {plan === "PAID" ? "Custom domain plan" : "Free"}
        </p>
        {lodge.subscriptionStatus ? (
          <p className="text-sm text-neutral-600" data-testid="subscription-status">
            Subscription status: {lodge.subscriptionStatus}
            {lodge.currentPeriodEnd ? ` · current period ends ${lodge.currentPeriodEnd.toLocaleDateString()}` : ""}
          </p>
        ) : null}
        {plan !== "PAID" && lodge.subscriptionStatus && lodge.subscriptionStatus !== "active" ? (
          <p className="alert-info mt-3">
            Your subscription has lapsed. Your site stays online at its free subdomain; custom domains resume as soon as
            you re-subscribe.
          </p>
        ) : null}
        <div className="mt-4 flex gap-3">
          {plan !== "PAID" ? (
            <form action={startCheckout}>
              <button className="btn-primary" type="submit" data-testid="upgrade-button">
                Upgrade with Stripe
              </button>
            </form>
          ) : null}
          {lodge.stripeCustomerId ? (
            <form action={openBillingPortal}>
              <button className="btn-secondary" type="submit" data-testid="portal-button">
                Manage subscription
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <section className="card text-sm text-neutral-600">
        <h3 className="font-semibold text-neutral-900">What the paid plan adds</h3>
        <ul className="mt-2 list-disc pl-5">
          <li>Serve your site from your own domain with automatic HTTPS</li>
          <li>Premium templates as they are released</li>
        </ul>
        <p className="mt-3">If a subscription lapses your site is never taken down; it simply falls back to its free subdomain.</p>
      </section>
    </div>
  );
}
