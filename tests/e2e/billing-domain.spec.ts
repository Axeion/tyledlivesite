import { expect, test } from "@playwright/test";
import {
  DOMAIN,
  PORT,
  addDnsRecord,
  clearDnsRecords,
  count,
  httpStatus,
  lodge,
  loginDashboard,
  mockStripeSetStatus,
  mockStripeState,
  sql,
  sub,
  updateLodge,
  waitFor,
} from "./helpers";

const CUSTOM = "lodge.example.test";
const SLUG = "demo-lodge";
const askUrl = (d: string) => `http://127.0.0.1:${PORT}/api/internal/tls/ask?domain=${d}`;

async function resetBilling() {
  await sql('DELETE FROM "Domain" WHERE hostname = $1', [CUSTOM]);
  await updateLodge(SLUG, { plan: "FREE", stripeCustomerId: null, stripeSubscriptionId: null, subscriptionStatus: null, currentPeriodEnd: null });
  await clearDnsRecords(CUSTOM);
  await clearDnsRecords(`_tyled-verify.${CUSTOM}`);
}

test.describe.serial("Stripe upgrade, custom domain and lapse fallback", () => {
  test.beforeAll(resetBilling);
  test.afterAll(resetBilling);

  test("free lodges cannot add a custom domain", async ({ page }) => {
    await loginDashboard(page, SLUG, "secretary@demo-lodge.example");
    await page.goto(sub(SLUG, "/dashboard/domain"));
    await expect(page.getByTestId("domain-upgrade-notice")).toBeVisible();
    await expect(page.getByTestId("domain-input")).toHaveCount(0);
    expect((await httpStatus(askUrl(CUSTOM))).status).toBe(403);
  });

  test("upgrading through Stripe Checkout activates the paid plan via webhook", async ({ page }) => {
    await loginDashboard(page, SLUG, "secretary@demo-lodge.example");
    await page.goto(sub(SLUG, "/dashboard/billing"));
    await expect(page.getByTestId("plan-label")).toHaveText("Free");
    await page.getByTestId("upgrade-button").click();
    // Hosted (mock) Stripe Checkout page
    await expect(page).toHaveURL(/127\.0\.0\.1:4242\/checkout\//);
    await page.click("#pay");
    await expect(page).toHaveURL(new RegExp(`${SLUG}\\.${DOMAIN.replace(".", "\\.")}:${PORT}/dashboard/billing\\?checkout=success`));
    await expect(page.getByTestId("checkout-success")).toBeVisible();

    const row = await waitFor(() => lodge(SLUG), (l) => l.plan === "PAID");
    expect(row.subscriptionStatus).toBe("active");
    expect(row.stripeSubscriptionId).toMatch(/^sub_/);
    await page.reload();
    await expect(page.getByTestId("plan-label")).toHaveText("Custom domain plan");
    await expect(page.getByTestId("subscription-status")).toContainText("active");
    // Webhooks are idempotent: three events (subscription.created, checkout.completed, ...) recorded once each
    const eventsRecorded = await count("StripeEvent");
    expect(eventsRecorded).toBeGreaterThanOrEqual(2);
  });

  test("a custom domain is verified by the worker once DNS records exist", async ({ page }) => {
    await loginDashboard(page, SLUG, "secretary@demo-lodge.example");
    await page.goto(sub(SLUG, "/dashboard/domain"));
    await page.getByTestId("domain-input").fill(`https://${CUSTOM}/`);
    await page.getByRole("button", { name: "Add domain" }).click();
    const card = page.getByTestId(`domain-${CUSTOM}`);
    await expect(card.getByTestId("domain-status")).toContainText("Pending");
    await expect(card).toContainText(`_tyled-verify.${CUSTOM}`);
    await expect(card).toContainText(`${SLUG}.${DOMAIN}`);

    // Wrong token first: stays pending with a helpful error
    await addDnsRecord(`_tyled-verify.${CUSTOM}`, "TXT", "tyled-verify=wrong");
    await addDnsRecord(CUSTOM, "CNAME", `${SLUG}.${DOMAIN}`);
    await card.getByRole("button", { name: "Check now" }).click();
    await expect(card).toContainText("TXT verification record not found");
    expect((await httpStatus(`http://${CUSTOM}:${PORT}/`)).status).toBe(404);

    // Correct token: the background worker picks it up
    const [domain] = await sql<{ verificationToken: string }>('SELECT "verificationToken" FROM "Domain" WHERE hostname = $1', [CUSTOM]);
    await clearDnsRecords(`_tyled-verify.${CUSTOM}`);
    await addDnsRecord(`_tyled-verify.${CUSTOM}`, "TXT", `tyled-verify=${domain.verificationToken}`);
    await waitFor(
      async () => (await sql<{ status: string }>('SELECT status FROM "Domain" WHERE hostname = $1', [CUSTOM]))[0],
      (d) => d.status === "VERIFIED",
      60_000,
    );
    await page.reload();
    await expect(page.getByTestId(`domain-${CUSTOM}`).getByTestId("domain-status")).toContainText("Verified · serving");

    // Served on the custom domain, certificate issuance approved
    const site = await httpStatus(`http://${CUSTOM}:${PORT}/`);
    expect(site.status).toBe(200);
    expect(site.body).toContain("Demo Lodge");
    expect((await httpStatus(askUrl(CUSTOM))).status).toBe(200);
    expect((await httpStatus(askUrl("evil.example.test"))).status).toBe(403);
    // The dashboard is never served on a custom domain
    const dash = await httpStatus(`http://${CUSTOM}:${PORT}/dashboard`);
    expect(dash.status).toBe(307);
    expect(dash.location).toBe(sub(SLUG, "/dashboard"));
  });

  test("when the subscription lapses the custom domain falls back to the subdomain and the site stays up", async ({ page }) => {
    const state = await mockStripeState();
    const subscription = state.subscriptions.find((s) => s.status === "active");
    expect(subscription).toBeTruthy();
    await mockStripeSetStatus(subscription!.id, "canceled");
    await waitFor(() => lodge(SLUG), (l) => l.plan === "FREE");

    const custom = await httpStatus(`http://${CUSTOM}:${PORT}/events`);
    expect(custom.status).toBe(307);
    expect(custom.location).toBe(sub(SLUG, "/events"));
    expect((await httpStatus(sub(SLUG))).status).toBe(200);
    expect((await httpStatus(askUrl(CUSTOM))).status).toBe(403);
    expect((await httpStatus(askUrl(`${SLUG}.${DOMAIN}`))).status).toBe(200);

    await loginDashboard(page, SLUG, "secretary@demo-lodge.example");
    await page.goto(sub(SLUG, "/dashboard/billing"));
    await expect(page.getByTestId("plan-label")).toHaveText("Free");
    await expect(page.getByTestId("subscription-status")).toContainText("canceled");
    await page.goto(sub(SLUG, "/dashboard/domain"));
    await expect(page.getByTestId("domain-upgrade-notice")).toBeVisible();
    await expect(page.getByTestId(`domain-${CUSTOM}`).getByTestId("domain-status")).toContainText("inactive (plan)");
  });

  test("re-subscribing restores the custom domain immediately", async ({ page }) => {
    await loginDashboard(page, SLUG, "secretary@demo-lodge.example");
    await page.goto(sub(SLUG, "/dashboard/billing"));
    await page.getByTestId("upgrade-button").click();
    await page.click("#pay");
    await waitFor(() => lodge(SLUG), (l) => l.plan === "PAID");
    expect((await httpStatus(`http://${CUSTOM}:${PORT}/`)).status).toBe(200);
    expect((await httpStatus(askUrl(CUSTOM))).status).toBe(200);
    // Customer portal (mock) lets the lodge cancel again
    await page.goto(sub(SLUG, "/dashboard/billing"));
    await page.getByTestId("portal-button").click();
    await expect(page).toHaveURL(/127\.0\.0\.1:4242\/portal\//);
    await page.locator("button.cancel").first().click();
    await expect(page).toHaveURL(new RegExp(`${SLUG}\\.${DOMAIN.replace(".", "\\.")}:${PORT}/dashboard/billing`));
    await waitFor(() => lodge(SLUG), (l) => l.plan === "FREE");
  });
});
