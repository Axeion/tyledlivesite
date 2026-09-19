import { expect, test } from "@playwright/test";
import { DOMAIN, PORT, apex, httpStatus, lodge, loginAdmin, sql, sub } from "./helpers";

const SLUG = "e2e-lodge";
const EMAIL = "e2e-secretary@example.test";
const PASSWORD = "e2e-password-123";

test.describe.serial("signup, approval and publish", () => {
  test.beforeAll(async () => {
    await sql('DELETE FROM "Lodge" WHERE slug = $1', [SLUG]);
    await sql('DELETE FROM "User" WHERE email = $1', [EMAIL]);
    await sql('DELETE FROM "SignupAttempt"');
  });

  test("a lodge can sign up through the wizard and lands on its pending dashboard", async ({ page }) => {
    await page.goto(apex("/signup"));
    // Step 1: account
    await page.fill("#acct-name", "E2E Secretary");
    await page.fill("#acct-email", EMAIL);
    await page.fill("#acct-password", PASSWORD);
    await page.getByTestId("signup-next").click();
    // Step 2: template
    await expect(page.getByTestId("signup-step-1")).toBeVisible();
    await page.getByTestId("template-modern").click();
    await page.getByTestId("signup-next").click();
    // Step 3: details
    await page.fill("#lodge-name", "E2E Lodge");
    await page.fill("#lodge-number", "99");
    await page.fill("#lodge-jurisdiction", "Grand Lodge of Testing");
    await expect(page.locator("#lodge-slug")).toHaveValue("e2e-lodge-99");
    await page.fill("#lodge-slug", SLUG);
    await expect(page.getByTestId("slug-status")).toHaveText("Available");
    await page.fill("#lodge-tagline", "Testing since 2026");
    await page.fill("#lodge-schedule", "2nd Tuesday monthly, 7:30 PM");
    await page.fill("#lodge-about", "<p>We are an <strong>end-to-end</strong> lodge.</p><script>alert(1)</script>");
    await page.fill("#lodge-email", "hall@e2e.example.test");
    await page.fill("#lodge-addr1", "100 Main Street");
    await page.fill("#lodge-city", "Springfield");
    await page.fill("#lodge-region", "IL");
    await page.fill("#lodge-postal", "62701");
    await page.getByTestId("signup-next").click();
    // Step 4: preview renders the chosen template with entered data
    await expect(page.getByTestId("signup-preview")).toBeVisible();
    await expect(page.getByTestId("signup-preview").locator('[data-template="modern"]')).toBeVisible();
    await expect(page.getByTestId("signup-preview")).toContainText("E2E Lodge");
    await expect(page.getByTestId("signup-preview")).toContainText("Testing since 2026");
    await page.getByTestId("signup-next").click();
    // Step 5: submit -> handed off to the subdomain dashboard
    await expect(page.getByTestId("signup-step-4")).toContainText(`${SLUG}.${DOMAIN}`);
    await page.getByTestId("signup-submit").click();
    await expect(page).toHaveURL(new RegExp(`^http://${SLUG}\\.${DOMAIN.replace(".", "\\.")}:${PORT}/dashboard`));
    await expect(page.getByTestId("status-card")).toContainText("Awaiting approval");
    await expect(page.getByTestId("current-user")).toContainText(EMAIL);

    const row = await lodge(SLUG);
    expect(row.status).toBe("PENDING_REVIEW");
    expect(row.published).toBe(false);
    expect(row.templateId).toBe("modern");
    // Script tag stripped, formatting kept
    expect(row.about).toContain("<strong>end-to-end</strong>");
    expect(row.about).not.toContain("<script");
  });

  test("the public site shows coming soon until approved", async ({ page }) => {
    await page.goto(sub(SLUG));
    await expect(page.getByTestId("coming-soon")).toBeVisible();
    expect((await httpStatus(sub(SLUG, "/calendar.ics"))).status).toBe(404);
  });

  test("the platform admin approves the lodge from the queue", async ({ page }) => {
    await loginAdmin(page);
    const queueRow = page.getByTestId(`queue-${SLUG}`);
    await expect(queueRow).toContainText("E2E Lodge No. 99");
    await queueRow.getByRole("button", { name: "Approve & publish" }).click();
    await expect(page.getByTestId(`queue-${SLUG}`)).toHaveCount(0);
    const row = await lodge(SLUG);
    expect(row.status).toBe("APPROVED");
    expect(row.published).toBe(true);
  });

  test("the approved site is live on its subdomain with the chosen template and a map", async ({ page }) => {
    await page.goto(sub(SLUG));
    await expect(page.locator('[data-template="modern"]')).toBeVisible();
    await expect(page.locator("h1")).toContainText("E2E Lodge");
    await expect(page.getByTestId("address")).toContainText("100 Main Street");
    // Worker geocodes the address via (mock) Nominatim; the Leaflet map mounts once lat/lng exist.
    await expect(async () => {
      await page.reload();
      await expect(page.getByTestId("lodge-map")).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 60_000 });
    const row = await lodge(SLUG);
    expect(row.lat).toBeCloseTo(39.7817, 3);
    expect(row.lng).toBeCloseTo(-89.6501, 3);
  });

  test("the lodge admin can unpublish and republish without losing content", async ({ page }) => {
    await page.goto(sub(SLUG, "/dashboard/login"));
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.click("button[type=submit]");
    await expect(page.getByTestId("publish-state")).toContainText("live");
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByTestId("publish-state")).toContainText("unpublished");
    expect((await httpStatus(sub(SLUG))).body).toContain('data-testid="coming-soon"');
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByTestId("publish-state")).toContainText("live");
    expect((await httpStatus(sub(SLUG))).body).toContain("E2E Lodge");
  });

  test("rejected submissions show the reason and can be resubmitted", async ({ page }) => {
    const row = await lodge(SLUG);
    await loginAdmin(page);
    await page.goto(apex(`/admin/lodges/${row.id}`));
    await page.fill('input[name="reason"]', "Lodge number does not match the Grand Lodge register");
    await page.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByTestId("lodge-status")).toHaveText("REJECTED");
    expect((await httpStatus(sub(SLUG))).body).toContain('data-testid="coming-soon"');

    await page.context().clearCookies();
    await page.goto(sub(SLUG, "/dashboard/login"));
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.click("button[type=submit]");
    await expect(page.getByTestId("status-card")).toContainText("Lodge number does not match");
    await page.getByRole("button", { name: "Resubmit for review" }).click();
    await expect(page.getByTestId("status-card")).toContainText("Awaiting approval");

    // Approve again so later specs can use the lodge.
    await page.context().clearCookies();
    await loginAdmin(page);
    await page.getByTestId(`queue-${SLUG}`).getByRole("button", { name: "Approve & publish" }).click();
    await expect(page.getByTestId(`queue-${SLUG}`)).toHaveCount(0);
  });
});
