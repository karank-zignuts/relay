import { test, expect } from "./fixtures";
import { asRole } from "./roles";

asRole("project_manager");

test("the table header stays pinned while rows scroll", async ({ page }) => {
  await page.goto("/tasks");
  const rows = page.getByTestId("task-row");
  await rows.first().waitFor({ timeout: 45_000 });
  test.skip((await rows.count()) < 12, "needs enough rows to scroll");

  const scroll = page.getByTestId("task-scroll");
  const header = page.getByRole("columnheader", { name: "Title" });
  const before = await scroll.boundingBox();
  await scroll.evaluate((element) => (element.scrollTop = 600));

  const box = await header.boundingBox();
  expect(await scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
  expect(Math.abs(box!.y - before!.y)).toBeLessThan(2); // header still at the top edge of the table area
  await expect(header).toBeVisible();
});

test("the page itself does not scroll behind the table", async ({ page }) => {
  await page.goto("/tasks");
  await page.getByTestId("task-row").first().waitFor({ timeout: 45_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight);
  expect(overflow).toBeLessThanOrEqual(1);
});
