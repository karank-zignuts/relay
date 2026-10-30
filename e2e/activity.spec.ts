import { test, expect } from "./fixtures";
import { asRole } from "./roles";
import { choose } from "./helpers";

asRole("project_manager");

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/activity");
  await page.getByTestId("activity-row").first().waitFor({ timeout: 45_000 });
});

const rows = (page: import("@playwright/test").Page) => page.getByTestId("activity-row");

test("filters by type, person and time range", async ({ page }) => {
  await choose(page, "Activity type", "Sign-ins");
  await expect.poll(async () => (await rows(page).allInnerTexts()).every((text) => text.includes("signed in"))).toBe(true);

  await page.getByRole("button", { name: "Filter by People" }).click();
  await page.getByRole("menuitemcheckbox", { name: "E2E project manager" }).click();
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await rows(page).allInnerTexts()).every((text) => text.startsWith("E2E project manager"))).toBe(true);
  await expect(rows(page).first()).toBeVisible();

  // The suite signed in moments ago, so it is inside the last hour; nothing older may remain.
  await choose(page, "Time range", "Last hour");
  await expect(rows(page).first()).toBeVisible();
  const stamps = await page.locator("[data-testid=activity-row] time").evaluateAll((els) => els.map((el) => Date.parse(el.getAttribute("datetime")!)));
  expect(stamps.length).toBeGreaterThan(0);
  expect(stamps.every((stamp) => stamp >= Date.now() - 3_600_000 - 60_000)).toBe(true);

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("button", { name: "Clear filters" })).toHaveCount(0);
});

test("a custom date and time range narrows the feed and says so when nothing matches", async ({ page }) => {
  await choose(page, "Time range", "Custom range…");
  const range = page.getByTestId("custom-range");
  const today = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date());

  await range.getByLabel("From date").click();
  await page.getByRole("button", { name: today, exact: true }).click();
  await expect(page.getByRole("button", { name: today, exact: true })).toHaveCount(0); // calendar closed
  await range.getByLabel("To date").click();
  await page.getByRole("button", { name: today, exact: true }).click();
  await expect(rows(page).first()).toBeVisible(); // all of today

  await range.getByLabel("From time").fill("99:99");
  await expect(range.getByLabel("From time")).toHaveAttribute("aria-invalid", "true"); // a bad time is flagged and ignored
  await expect(rows(page).first()).toBeVisible();

  await range.getByLabel("From time").fill("23:59");
  await expect(page.getByText("Nothing matches these filters")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await expect(rows(page).first()).toBeVisible();
});

test("the date header stays at the top while its entries scroll, so you know which day you are on", async ({ page }) => {
  const scroll = page.getByTestId("activity-scroll");
  const header = page.getByTestId("activity-day").first();
  await expect(header).toBeVisible();
  await scroll.evaluate((el) => (el.scrollTop = 400));
  await page.waitForTimeout(150);
  const top = (await scroll.boundingBox())!.y;
  const y = (await header.boundingBox())!.y;
  expect(Math.abs(y - top)).toBeLessThanOrEqual(2);
});
