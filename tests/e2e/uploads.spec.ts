import { expect, test } from "@playwright/test";
import { PNG_1x1, count, httpStatus, lodge, loginDashboard, sql, sub } from "./helpers";

test.describe.serial("image uploads", () => {
  test.afterAll(async () => {
    await sql('DELETE FROM "GalleryImage" WHERE caption LIKE $1', ["E2E%"]);
  });

  test("a valid PNG is stored and served on the public gallery", async ({ page }) => {
    await loginDashboard(page, "demo-lodge", "secretary@demo-lodge.example");
    await page.goto(sub("demo-lodge", "/dashboard/gallery"));
    await page.getByTestId("gallery-file").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG_1x1 });
    await page.fill("#caption", "E2E photo");
    await page.getByRole("button", { name: "Upload photo" }).click();
    await expect(page.getByTestId("form-ok")).toContainText("Photo added");
    const img = page.getByTestId("gallery-grid").locator("img").last();
    const src = await img.getAttribute("src");
    expect(src).toMatch(/^http:\/\/127\.0\.0\.1:4569\/tyled-uploads\/lodges\/.+\/gallery\/[a-f0-9]{32}\.png$/);
    const object = await fetch(src!);
    expect(object.status).toBe(200);
    expect(object.headers.get("content-type")).toBe("image/png");
    const publicGallery = await httpStatus(sub("demo-lodge", "/gallery"));
    expect(publicGallery.body).toContain("E2E photo");
  });

  test("SVG, disguised executables and oversized files are rejected", async ({ page }) => {
    await loginDashboard(page, "demo-lodge", "secretary@demo-lodge.example");
    await page.goto(sub("demo-lodge", "/dashboard/gallery"));
    const before = await count("GalleryImage");

    await page.getByTestId("gallery-file").setInputFiles({
      name: "evil.png",
      mimeType: "image/png",
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    });
    await page.getByRole("button", { name: "Upload photo" }).click();
    await expect(page.getByTestId("form-error")).toContainText("Only PNG, JPEG and WebP");

    await page.getByTestId("gallery-file").setInputFiles({ name: "tool.jpg", mimeType: "image/jpeg", buffer: Buffer.concat([Buffer.from("MZ"), Buffer.alloc(200)]) });
    await page.getByRole("button", { name: "Upload photo" }).click();
    await expect(page.getByTestId("form-error")).toContainText("Only PNG, JPEG and WebP");

    await page.getByTestId("gallery-file").setInputFiles({ name: "huge.png", mimeType: "image/png", buffer: Buffer.concat([PNG_1x1, Buffer.alloc(5 * 1024 * 1024)]) });
    await page.getByRole("button", { name: "Upload photo" }).click();
    await expect(page.getByTestId("form-error")).toContainText(/limit|too large|Body exceeded/i);

    expect(await count("GalleryImage")).toBe(before);
  });

  test("logo upload updates the public site header", async ({ page }) => {
    await loginDashboard(page, "demo-lodge", "secretary@demo-lodge.example");
    await page.goto(sub("demo-lodge", "/dashboard/content"));
    await page.getByTestId("logo-file").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG_1x1 });
    await page.getByTestId("logo-file").locator("xpath=ancestor::form").getByRole("button", { name: "Upload" }).click();
    await expect(page.getByTestId("logo-image")).toBeVisible();
    const row = await lodge("demo-lodge");
    expect(row.logoKey).toMatch(/^lodges\/.+\/logo\/[a-f0-9]{32}\.png$/);
    expect((await httpStatus(sub("demo-lodge"))).body).toContain(row.logoKey!);
    await page.getByRole("button", { name: "Remove" }).first().click();
    await expect(page.getByTestId("logo-image")).toHaveCount(0);
  });
});
