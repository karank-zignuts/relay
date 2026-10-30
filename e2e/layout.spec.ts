import { test, expect } from "./fixtures";
import { asRole } from "./roles";

asRole("project_manager");

const pageOverflow = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight);

test("Board is not in the top menu, it lives inside Tasks", async ({ page }) => {
  await page.goto("/tasks");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Tasks" })).toBeVisible({ timeout: 45_000 });
  await expect(nav.getByRole("link", { name: "Board" })).toHaveCount(0);
  await page.getByRole("navigation", { name: "View" }).getByRole("link", { name: "Board" }).click();
  await expect(page).toHaveURL(/\/board/);
});

test("the header is compact until filters are opened, and remembers the choice", async ({ page }) => {
  await page.goto("/tasks");
  await page.getByTestId("task-row").first().waitFor({ timeout: 45_000 });
  await expect(page.getByLabel("Search tasks")).toBeVisible();
  await expect(page.getByRole("button", { name: "Filter by Status" })).toHaveCount(0);

  await page.getByRole("button", { name: "Show filters" }).click();
  await expect(page.getByRole("button", { name: "Filter by Status" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Filter by Status" })).toBeVisible();
  await page.getByRole("button", { name: "Hide filters" }).click(); // leave it as we found it
  await expect(page.getByRole("button", { name: "Filter by Status" })).toHaveCount(0);
});

test("the board fits the screen and each column scrolls on its own", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto("/board");
  await page.getByTestId("kanban-card").first().waitFor({ timeout: 45_000 });
  expect(await pageOverflow(page)).toBeLessThanOrEqual(1);

  const column = page.getByTestId("column-to_do");
  const box = await column.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(800 + 1); // column ends inside the first screen

  const scroller = column.getByTestId("column-scroll");
  const cards = await column.getByTestId("kanban-card").count();
  test.skip(cards < 8, "needs enough cards to overflow");
  expect(await scroller.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
});

test("the activity feed fits the screen and scrolls inside", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto("/activity");
  await page.getByTestId("activity-row").first().waitFor({ timeout: 45_000 });
  expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
  const scroller = page.getByTestId("activity-scroll");
  expect(await scroller.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
});

test("the task panel can be resized by dragging its edge", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto("/tasks");
  await page.getByTestId("task-row").first().click({ timeout: 45_000 });
  const panel = page.getByTestId("task-drawer");
  await panel.waitFor();
  await page.waitForTimeout(300); // let the slide-in finish
  const start = (await panel.boundingBox())!.width;

  const handle = (await page.getByTestId("drawer-resize").boundingBox())!;
  const y = handle.y + handle.height / 2;
  await page.mouse.move(handle.x + handle.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(handle.x - 150, y, { steps: 8 });
  await page.mouse.up();
  const wider = (await panel.boundingBox())!.width;
  expect(wider).toBeGreaterThan(start + 100);

  await page.getByTestId("drawer-resize").dblclick(); // double-click toggles wide / default
  await expect.poll(async () => (await panel.boundingBox())!.width).not.toBe(wider);
});
