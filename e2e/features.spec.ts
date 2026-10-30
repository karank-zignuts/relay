import { test, expect } from "./fixtures";
import { asRole } from "./roles";
import { clientAs, openTask, pickCombo, uid } from "./helpers";

asRole("super_admin");
test.describe.configure({ mode: "serial" });

const id = uid();
const title = `E2E task ${id} before`;
let taskId = "";

test.beforeAll(async () => {
  const { supabase, userId } = await clientAs("super_admin");
  const { data, error } = await supabase.from("tasks").insert({ title, description: "Made by the e2e suite", created_by: userId }).select("id").single();
  if (error) throw new Error(error.message);
  taskId = data.id;
});

test("task numbers start at 1 and sorting has a third, normal state", async ({ page }) => {
  await page.goto("/tasks");
  await page.getByTestId("task-row").first().waitFor({ timeout: 45_000 });

  const number = page.locator("th button", { hasText: /^#$/ });
  await number.click();
  await expect(page.getByTestId("task-row").first().getByRole("cell").first()).toHaveText("#1");

  const header = page.getByRole("columnheader", { name: "Title" });
  const sortButton = header.getByRole("button");
  await sortButton.click();
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  await sortButton.click();
  await expect(header).toHaveAttribute("aria-sort", "descending");
  await sortButton.click();
  await expect(header).not.toHaveAttribute("aria-sort", /.+/);
});

test("pages come from the server", async ({ page }) => {
  await page.goto("/tasks");
  await expect(page.getByTestId("table-range")).toHaveText(/Showing 1–50 of \d+/, { timeout: 45_000 });
  const requests: string[] = [];
  page.on("request", (request) => request.url().includes("/rpc/list_tasks") && requests.push(request.postData() ?? ""));
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByTestId("table-range")).toHaveText(/Showing 51–/);
  expect(requests.some((body) => body.includes('"p_offset":50'))).toBe(true);
});

test("an unassigned task shows a question-mark avatar that opens the assignee list", async ({ page }) => {
  await page.goto("/tasks");
  await page.getByLabel("Search tasks").fill(`E2E task ${id}`);
  const row = page.getByTestId("task-row").filter({ hasText: title });
  const avatar = row.getByRole("img", { name: "Unassigned" });
  await expect(avatar).toHaveText("?");
  await avatar.click();
  await expect(page.getByRole("option", { name: "E2E developer" })).toBeVisible();
  await page.getByRole("option", { name: "E2E developer" }).click();
  await page.keyboard.press("Escape");
  await expect(row.getByRole("img", { name: "Unassigned" })).toHaveCount(0);
});

test("priority and module change in place, and a new module joins the list", async ({ page }) => {
  await page.goto("/tasks");
  await page.getByLabel("Search tasks").fill(`E2E task ${id}`);
  const row = page.getByTestId("task-row").filter({ hasText: title });
  await row.getByRole("button", { name: /Change priority/ }).click();
  await page.getByRole("option", { name: "Urgent" }).click();
  await expect(row).toContainText("Urgent");

  const moduleName = `E2E module ${id}`;
  await row.getByRole("button", { name: /Change module/ }).click();
  await page.getByRole("textbox", { name: /Find or add/ }).fill(moduleName);
  await page.getByRole("option", { name: new RegExp(`Create .*${moduleName}`) }).click();
  await expect(row).toContainText(moduleName);

  // The module is now stored, so it is offered everywhere.
  await row.getByRole("button", { name: /Change module/ }).click();
  await page.getByRole("textbox", { name: /Find or add/ }).fill(`module ${id}`);
  await expect(page.getByRole("option", { name: moduleName })).toBeVisible();
});

test("the panel has select fields for module and tags, attachments and a send button", async ({ page }) => {
  await page.goto("/tasks");
  await page.getByLabel("Search tasks").fill(`E2E task ${id}`);
  await openTask(page.getByTestId("task-row").filter({ hasText: title }));
  const drawer = page.getByTestId("task-drawer");

  await expect(drawer.getByLabel("Module", { exact: true })).toHaveRole("button");
  await pickCombo(drawer, "Tags", "bug");
  await page.getByRole("textbox", { name: /Find or add/ }).fill("chore"); // the list stays open for the next tag
  await page.getByRole("option", { name: /chore/ }).first().click();
  await page.keyboard.press("Escape");
  await expect(drawer.getByLabel("Remove bug")).toBeVisible();
  await expect(drawer.getByLabel("Remove chore")).toBeVisible();

  await expect(drawer.getByTestId("client-attachments")).toBeVisible();
  await drawer.getByTestId("attachment-input").setInputFiles({ name: "e2e-note.txt", mimeType: "text/plain", buffer: Buffer.from("hello from the e2e suite") });
  const team = drawer.getByTestId("team-attachments");
  await expect(team.getByTestId("attachment")).toContainText("e2e-note.txt");
  await expect(team.getByTestId("attachment")).toContainText("E2E super admin");
  await team.getByRole("button", { name: "Remove e2e-note.txt" }).click({ force: true });
  await expect(team.getByTestId("attachment")).toHaveCount(0);

  await expect(drawer.getByRole("button", { name: "Send comment" })).toContainText("Send");
});

test("a comment can be edited and shows who has seen it", async ({ page, browser, baseURL }) => {
  await page.goto("/tasks");
  await page.getByLabel("Search tasks").fill(`E2E task ${id}`);
  await openTask(page.getByTestId("task-row").filter({ hasText: title }));
  const drawer = page.getByTestId("task-drawer");

  await drawer.getByLabel("Write a comment").fill("First draft");
  await drawer.getByRole("button", { name: "Send comment" }).click();
  await expect(drawer.getByTestId("comment").filter({ hasText: "First draft" })).toBeVisible();
  const comment = drawer.getByTestId("comment").last();
  await expect(comment.getByTestId("seen-by")).toHaveCount(0);

  await comment.hover();
  await comment.getByRole("button", { name: "Edit comment" }).click();
  await comment.getByLabel("Edit comment", { exact: true }).fill("Final wording");
  await comment.getByRole("button", { name: "Save" }).click();
  await expect(comment).toContainText("Final wording");
  await expect(comment).toContainText("edited");

  // A teammate opens the task. The author sees it was read, live.
  const context = await browser.newContext({ storageState: "e2e/.auth/project_manager.json", baseURL });
  const other = await context.newPage();
  await other.goto("/tasks");
  await other.getByLabel("Search tasks").fill(`E2E task ${id}`);
  await openTask(other.getByTestId("task-row").filter({ hasText: title }));
  await expect(other.getByTestId("task-drawer").getByTestId("comment")).toContainText("Final wording");
  await expect(page.getByTestId("task-drawer").getByTestId("seen-by")).toContainText("Seen by", { timeout: 25_000 });
  await context.close();
});

test("changes from someone else appear without reloading", async ({ page }) => {
  await page.goto("/tasks");
  await page.getByLabel("Search tasks").fill(`E2E task ${id}`);
  const row = page.getByTestId("task-row");
  await expect(row).toContainText("before", { timeout: 45_000 });
  await expect(page.getByTestId("live-status")).toHaveAttribute("data-status", "live", { timeout: 20_000 });

  const { supabase } = await clientAs("project_manager");
  const { error } = await supabase.from("tasks").update({ title: `E2E task ${id} after` }).eq("id", taskId);
  expect(error).toBeNull();
  await expect(row).toContainText("after", { timeout: 15_000 });
});

test("dragging over a column shows where the card will land, and Hide done hides the column", async ({ page }) => {
  await page.goto("/board");
  const column = page.getByTestId("column-to_do");
  const cards = column.getByTestId("kanban-card");
  await expect(cards.nth(2)).toBeVisible({ timeout: 45_000 });

  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await cards.nth(0).dispatchEvent("dragstart", { dataTransfer });
  await cards.nth(2).dispatchEvent("dragover", { dataTransfer, clientY: (await cards.nth(2).boundingBox())!.y + 2 });
  await expect(column.getByTestId("drop-placeholder")).toHaveCount(1);
  await cards.nth(0).dispatchEvent("dragend", { dataTransfer });
  await expect(column.getByTestId("drop-placeholder")).toHaveCount(0);

  await page.getByRole("button", { name: "Hide done" }).click();
  await expect(page.getByTestId("column-done")).toHaveCount(0);
});

test("the filters panel opens and closes", async ({ page }) => {
  await page.goto("/tasks");
  const panel = page.getByTestId("filters-panel");
  await expect(panel).toHaveAttribute("aria-hidden", "true");
  await page.getByRole("button", { name: "Show filters" }).click();
  await expect(panel).toHaveAttribute("aria-hidden", "false");
  await expect(page.getByRole("button", { name: "Filter by Status" })).toBeVisible();
  await page.getByRole("button", { name: "Hide filters" }).click();
  await expect(panel).toHaveAttribute("aria-hidden", "true");
});

test("clickable things show a pointer, and tooltips explain icons", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto("/tasks");
  await page.getByTestId("task-row").first().waitFor({ timeout: 45_000 });
  const cursor = (locator: ReturnType<typeof page.locator>) => locator.evaluate((element) => getComputedStyle(element).cursor);
  expect(await cursor(page.getByRole("button", { name: /New task/ }))).toBe("pointer");

  await page.getByRole("columnheader", { name: "Title" }).getByRole("button").hover();
  await expect(page.getByText("Sort by title")).toBeVisible();

  await openTask(page.getByTestId("task-row").first());
  await page.getByTestId("task-drawer").getByLabel("Status", { exact: true }).click();
  expect(await cursor(page.getByRole("option", { name: "Done" }))).toBe("pointer");
});

test("dragging the panel edge past the close line closes it while still dragging", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto("/tasks");
  await openTask(page.getByTestId("task-row").first());
  const panel = page.getByTestId("task-drawer");
  await panel.waitFor();
  await page.waitForTimeout(300);

  const handle = (await page.getByTestId("drawer-resize").boundingBox())!;
  const y = handle.y + handle.height / 2;
  await page.mouse.move(handle.x + handle.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(1440 - 120, y, { steps: 12 }); // still holding the button
  await expect(panel).toBeHidden({ timeout: 3_000 });
  await page.mouse.up();
});
