import { test, expect } from "./fixtures";
import { asRole } from "./roles";

asRole("project_manager");

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 }); // narrower than the columns, so the board must scroll sideways
  await page.goto("/board");
  await page.getByTestId("kanban-card").first().waitFor({ timeout: 45_000 });
});

const boardLeft = (page: import("@playwright/test").Page) => page.getByTestId("kanban").evaluate((el) => el.scrollLeft);
const columnsLeft = (page: import("@playwright/test").Page) => page.getByTestId("column-scroll").evaluateAll((els) => els.map((el) => el.scrollLeft));

test("a sideways swipe or Shift + wheel over a column scrolls the whole board, not the column", async ({ page }) => {
  const column = page.getByTestId("column-scroll").first();
  const box = (await column.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 60);

  expect(await boardLeft(page)).toBe(0);
  await page.mouse.wheel(300, 0); // two-finger sideways swipe
  await expect.poll(() => boardLeft(page)).toBeGreaterThan(100);
  expect((await columnsLeft(page)).every((left) => left === 0)).toBe(true);

  const afterSwipe = await boardLeft(page);
  await page.keyboard.down("Shift");
  await page.mouse.wheel(0, 200); // Shift + ordinary wheel
  await page.keyboard.up("Shift");
  await expect.poll(() => boardLeft(page)).toBeGreaterThan(afterSwipe);
  expect((await columnsLeft(page)).every((left) => left === 0)).toBe(true);

  // A plain vertical wheel still belongs to the column under the pointer.
  const before = await boardLeft(page);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(150);
  expect(await boardLeft(page)).toBe(before);
});

test("the corner scroller jumps to a spot and drags like Jira's", async ({ page }) => {
  const minimap = page.getByTestId("board-minimap");
  await expect(minimap).toBeVisible();
  const box = (await minimap.boundingBox())!;

  await page.mouse.click(box.x + box.width - 6, box.y + box.height / 2); // far right end
  await expect.poll(async () => page.getByTestId("kanban").evaluate((el) => Math.round(el.scrollWidth - el.clientWidth - el.scrollLeft))).toBeLessThanOrEqual(2);

  const win = (await page.getByTestId("board-minimap-window").boundingBox())!;
  const end = await boardLeft(page);
  await page.mouse.move(win.x + win.width / 2, win.y + win.height / 2);
  await page.mouse.down();
  await page.mouse.move(win.x + win.width / 2 - 30, win.y + win.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => boardLeft(page)).toBeLessThan(end - 50);

  await minimap.focus();
  const before = await boardLeft(page);
  await page.keyboard.press("Home");
  await expect.poll(() => boardLeft(page)).toBeLessThan(before);
  expect(await boardLeft(page)).toBe(0);
});
