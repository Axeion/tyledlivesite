import { expect, test } from "@playwright/test";
import { count, firstIdForLodge, httpStatus, loginDashboard, sql, sub, updateLodge } from "./helpers";

test.describe.serial("roles, tenant boundaries and template switching", () => {
  test.beforeAll(async () => {
    await sql('DELETE FROM "Officer" WHERE name = $1', ["E2E Chaplain"]);
  });
  test.afterAll(async () => {
    await updateLodge("demo-lodge", { templateId: "classic" });
    await sql('DELETE FROM "Officer" WHERE name = $1', ["E2E Chaplain"]);
  });

  test("editors can edit content but not reach admin-only sections", async ({ page }) => {
    await loginDashboard(page, "demo-lodge", "editor@demo-lodge.example");
    await expect(page.getByTestId("current-user")).toContainText("editor");
    await expect(page.getByRole("link", { name: "Template" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Billing" })).toHaveCount(0);
    for (const path of ["/dashboard/template", "/dashboard/domain", "/dashboard/billing", "/dashboard/members"]) {
      await page.goto(sub("demo-lodge", path));
      await expect(page).toHaveURL(/\/dashboard\?error=admin-only$/);
    }
    // Editors can add an officer.
    await page.goto(sub("demo-lodge", "/dashboard/officers"));
    await page.fill("#new-title", "Chaplain");
    await page.fill("#new-name", "E2E Chaplain");
    await page.getByTestId("officer-new").getByRole("button", { name: "Add officer" }).click();
    await expect(page.getByTestId("officer-new").getByTestId("form-ok")).toBeVisible();
    await expect(page.getByTestId("officer-rows").locator('input[name="name"]').last()).toHaveValue("E2E Chaplain");
    expect((await httpStatus(sub("demo-lodge", "/officers"))).body).toContain("E2E Chaplain");
    await sql('DELETE FROM "Officer" WHERE name = $1', ["E2E Chaplain"]);
  });

  test("a member of one lodge cannot sign in to another lodge's dashboard", async ({ page }) => {
    await page.goto(sub("harmony-lodge", "/dashboard/login"));
    await page.fill("#email", "secretary@demo-lodge.example");
    await page.fill("#password", process.env.SEED_LODGE_PASSWORD ?? "lodge-password-change-me");
    await page.click("button[type=submit]");
    await expect(page.getByTestId("form-error")).toContainText("not a member");
    expect((await httpStatus(sub("harmony-lodge", "/dashboard"))).status).toBe(307);
  });

  test("sessions are host-scoped: a demo-lodge session does not open harmony-lodge", async ({ page }) => {
    await loginDashboard(page, "demo-lodge", "secretary@demo-lodge.example");
    const res = await page.goto(sub("harmony-lodge", "/dashboard"));
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(/harmony-lodge.*\/dashboard\/login/);
  });

  test("editing another lodge's page by id is not found", async ({ page }) => {
    await loginDashboard(page, "demo-lodge", "secretary@demo-lodge.example");
    const harmonyPageId = await firstIdForLodge("Page", "harmony-lodge");
    const res = await page.goto(sub("demo-lodge", `/dashboard/pages/${harmonyPageId}`));
    expect(res?.status()).toBe(404);
    const harmonyEventId = await firstIdForLodge("Event", "harmony-lodge");
    const res2 = await page.goto(sub("demo-lodge", `/dashboard/events/${harmonyEventId}`));
    expect(res2?.status()).toBe(404);
  });

  test("switching templates keeps every piece of content", async ({ page }) => {
    await loginDashboard(page, "demo-lodge", "secretary@demo-lodge.example");
    const before = await httpStatus(sub("demo-lodge"));
    expect(before.body).toContain('data-template="classic"');
    expect(before.body).toContain("John A. Smith");
    expect(before.body).toContain("Stated Communication");

    await page.goto(sub("demo-lodge", "/dashboard/template"));
    await page.getByTestId("template-card-minimal").getByRole("button", { name: "Use Minimal" }).click();
    await expect(page.getByTestId("template-card-minimal").getByTestId("template-current")).toBeVisible();

    const after = await httpStatus(sub("demo-lodge"));
    expect(after.body).toContain('data-template="minimal"');
    expect(after.body).toContain("John A. Smith");
    expect(after.body).toContain("Stated Communication");
    expect((await httpStatus(sub("demo-lodge", "/p/history"))).body).toContain("Chartered in 1875");
    const where = '"lodgeId" = (SELECT id FROM "Lodge" WHERE slug = $1)';
    expect(await count("Officer", where, ["demo-lodge"])).toBe(5);
    expect(await count("Event", where, ["demo-lodge"])).toBe(3);
    expect(await count("Page", where, ["demo-lodge"])).toBe(2);
  });

  test("the dashboard preview renders the unpublished site with a banner", async ({ page }) => {
    await loginDashboard(page, "demo-lodge", "secretary@demo-lodge.example");
    await page.goto(sub("demo-lodge", "/dashboard/preview?page=officers"));
    await expect(page.getByTestId("preview-banner")).toBeVisible();
    await expect(page.getByTestId("preview-frame")).toContainText("John A. Smith");
  });
});
