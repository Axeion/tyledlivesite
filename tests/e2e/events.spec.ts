import { expect, test } from "@playwright/test";
import { count, httpStatus, loginDashboard, sql, sub } from "./helpers";

test.describe.serial("recurring events", () => {
  test.afterAll(async () => {
    await sql('DELETE FROM "Event" WHERE title = $1', ["E2E Fellowship Night"]);
  });

  test("creating a '2nd Tuesday monthly' event publishes it to the site, calendar and iCal feed", async ({ page }) => {
    await loginDashboard(page, "demo-lodge", "secretary@demo-lodge.example");
    await page.goto(sub("demo-lodge", "/dashboard/events"));
    await page.fill("#title", "E2E Fellowship Night");
    // Second Tuesday of next month at 19:00 (local lodge time)
    const now = new Date();
    const y = now.getUTCMonth() === 11 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
    const m = (now.getUTCMonth() + 1) % 12; // 0-based next month
    const first = new Date(Date.UTC(y, m, 1));
    const offsetToTuesday = (2 - first.getUTCDay() + 7) % 7;
    const secondTuesday = new Date(Date.UTC(y, m, 1 + offsetToTuesday + 7));
    const dateStr = secondTuesday.toISOString().slice(0, 10);
    await page.fill("#startsAt", `${dateStr}T19:00`);
    await page.fill("#endsAt", `${dateStr}T21:00`);
    await page.fill("#location", "Lodge Hall");
    await page.selectOption("#repeat-kind", "monthlyNthWeekday");
    await page.selectOption("#nth", "2");
    await page.selectOption("#weekday", "TU");
    await expect(page.getByTestId("rrule-value")).toHaveValue("FREQ=MONTHLY;BYDAY=2TU");
    await expect(page.getByTestId("repeat-summary")).toContainText("every month on the 2nd Tuesday");
    await page.getByRole("button", { name: "Create event" }).click();
    await expect(page).toHaveURL(/\/dashboard\/events\?saved=1$/);
    await expect(page.getByTestId("event-list")).toContainText("E2E Fellowship Night");
    await expect(page.getByTestId("event-list")).toContainText("every month on the 2nd Tuesday");

    const [stored] = await sql<{ rrule: string; startsAt: Date }>('SELECT rrule, "startsAt" FROM "Event" WHERE title = $1', ["E2E Fellowship Night"]);
    expect(stored.rrule).toBe("FREQ=MONTHLY;BYDAY=2TU");
    // 19:00 America/New_York is 23:00 or 00:00 UTC depending on DST
    expect([23, 0]).toContain(stored.startsAt.getUTCHours());

    const events = await httpStatus(sub("demo-lodge", "/events"));
    expect(events.body).toContain("E2E Fellowship Night");
    expect(events.body).toContain("Recurring");

    const ics = await httpStatus(sub("demo-lodge", "/calendar.ics"));
    expect(ics.status).toBe(200);
    expect(ics.body).toContain("SUMMARY:E2E Fellowship Night");
    expect(ics.body).toContain("RRULE:FREQ=MONTHLY;BYDAY=2TU");
    expect(ics.body).toContain(`DTSTART;TZID=America/New_York:${dateStr.replace(/-/g, "")}T190000`);

    // The month grid places it on the right day
    await page.goto(sub("demo-lodge", `/events/calendar?month=${dateStr.slice(0, 7)}`));
    await expect(page.getByTestId("month-calendar").locator(`[data-date="${dateStr}"]`)).toContainText("E2E Fellowship Night");
  });

  test("invalid recurrence rules are rejected", async ({ page }) => {
    await loginDashboard(page, "demo-lodge", "secretary@demo-lodge.example");
    await page.goto(sub("demo-lodge", "/dashboard/events"));
    await page.fill("#title", "Bad rule");
    await page.fill("#startsAt", "2027-01-05T19:00");
    await page.selectOption("#repeat-kind", "custom");
    await page.fill("#custom", "FREQ=MINUTELY");
    await page.getByRole("button", { name: "Create event" }).click();
    await expect(page.getByTestId("form-error")).toContainText("daily, weekly, monthly or yearly");
    expect(await count("Event", "title = $1", ["Bad rule"])).toBe(0);
  });
});
