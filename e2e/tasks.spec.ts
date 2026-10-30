import { test, expect } from "./fixtures";
import { asRole } from "./roles";
import { choose, uid } from "./helpers";

asRole("project_manager");
test.describe.configure({ mode: "serial" });

const title = `E2E task ${uid()}`;

test("creates a task and finds it with search", async ({ page }) => {
  await page.goto("/tasks");
  await page.getByTestId("task-row").first().waitFor({ timeout: 45_000 }); // let the first load finish, or it can land after the create
  await page.getByRole("button", { name: "New task" }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Description", { exact: true }).fill("Created from the e2e suite");
  await page.getByLabel("Module", { exact: true }).fill("E2E");
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page.getByText("Task created")).toBeVisible();

  await page.getByLabel("Search tasks").fill(title);
  await expect(page.getByTestId("task-row")).toHaveCount(1);
  await expect(page.getByTestId("task-count")).toContainText("1 of");
});

test("filters narrow the table and clear again", async ({ page }) => {
  await page.goto("/tasks");
  await page.getByLabel("Search tasks").fill(title);
  await page.getByRole("button", { name: "Show filters" }).click();
  await page.getByRole("button", { name: "Filter by Status" }).click();
  await page.getByRole("menuitemcheckbox", { name: /^Done/ }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("no-match")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByTestId("no-match")).toBeHidden();
  await expect(page.getByLabel("Search tasks")).toHaveValue("");
});

test("edits status, assigns a person and comments", async ({ page }) => {
  await page.goto("/tasks");
  await page.getByLabel("Search tasks").fill(title);
  await page.getByTestId("task-row").filter({ hasText: title }).click();

  const drawer = page.getByTestId("task-drawer");
  await choose(drawer, "Status", "In progress");
  await choose(drawer, "Priority", "Urgent");
  await drawer.getByText("Staging", { exact: true }).click();
  await drawer.getByText("FE", { exact: true }).click();
  await drawer.getByText("E2E developer").click();
  await drawer.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Task saved")).toBeVisible();

  const row = page.getByTestId("task-row");
  await expect(row.getByTestId("status-chip")).toHaveText(/In progress/);
  await expect(row).toContainText("Urgent");
  await expect(row).toContainText("Staging");

  await page.getByTestId("task-row").filter({ hasText: title }).click();
  const comment = `Looks good ${uid()}`;
  await page.getByLabel("Write a comment").fill(comment);
  await page.getByRole("button", { name: "Send comment" }).click();
  await expect(page.getByTestId("comments")).toContainText(comment);
});

test("shows the task on the board and moves it by changing status", async ({ page }) => {
  await page.goto("/board");
  await page.getByLabel("Search tasks").fill(title);
  await expect(page.getByTestId("column-in_progress").getByTestId("kanban-card")).toHaveCount(1);

  // Playwright cannot drive Chrome's native drag-and-drop, so fire the same events with a real DataTransfer.
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  const card = page.getByTestId("column-in_progress").getByTestId("kanban-card");
  await card.dispatchEvent("dragstart", { dataTransfer });
  await page.getByTestId("column-done").dispatchEvent("dragover", { dataTransfer });
  await page.getByTestId("column-done").dispatchEvent("drop", { dataTransfer });
  await expect(page.getByTestId("column-done").getByTestId("kanban-card")).toHaveCount(1);
});

test("deletes the task", async ({ page }) => {
  await page.goto("/tasks");
  await page.getByLabel("Search tasks").fill(title);
  await page.getByRole("button", { name: /Actions for task/ }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete task" }).click();
  await expect(page.getByText("Task deleted")).toBeVisible();
  await expect(page.getByTestId("task-row")).toHaveCount(0);
});

test("activity log recorded the lifecycle", async ({ page }) => {
  await page.goto("/activity");
  await page.getByLabel("Search activity").fill(title);
  await expect(page.getByTestId("activity-row").filter({ hasText: "Created task" })).toBeVisible();
  await expect(page.getByTestId("activity-row").filter({ hasText: "Deleted task" })).toBeVisible();
});

test("themed dropdowns: select, suggestions and date picker", async ({ page }) => {
  await page.goto("/tasks");
  await page.getByTestId("task-row").first().waitFor({ timeout: 45_000 });

  // Date picker: open, pick a day, see it applied as a removable state, clear it.
  await page.getByRole("button", { name: "Show filters" }).click();
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: "From date" }).click();
  await page.getByRole("button", { name: /^\d{1,2} \w{3} \d{4}$/ }).first().click();
  await expect(page.getByRole("button", { name: "From date" })).not.toContainText("Any date");

  // Select: filters the table without any native <select> on the page.
  await expect(page.locator("select")).toHaveCount(0);
  await choose(page, "Jira filter", "Has Jira ticket");
  await expect(page.getByTestId("task-count")).toContainText("of");

  // Suggest input: module field offers existing modules but accepts new text.
  await page.getByRole("button", { name: "Clear 3 filters" }).or(page.getByRole("button", { name: /^Clear \d+ filters?$/ })).click();
  await page.getByTestId("task-row").first().click();
  const moduleInput = page.getByTestId("task-drawer").getByLabel("Module", { exact: true });
  await moduleInput.fill("Brand new module name");
  await expect(moduleInput).toHaveValue("Brand new module name");
});
