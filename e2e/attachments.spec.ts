import { test, expect } from "./fixtures";
import { asRole } from "./roles";
import { openTask } from "./helpers";

asRole("project_manager");

// 1x1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("an upload is one tile from the first blink to the reveal, with no vanish and restart", async ({ page }) => {
  // Hold the upload so the placeholder stays up long enough to observe.
  await page.route("**/storage/v1/object/**", async (route) => {
    if (route.request().method() !== "GET") await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });

  await page.goto("/tasks");
  await openTask(page.getByTestId("task-row").first());
  const drawer = page.getByTestId("task-drawer");
  const team = drawer.getByTestId("team-attachments");
  const name = `e2e-pic-${Date.now()}.png`;

  await drawer.getByTestId("attachment-input").setInputFiles({ name, mimeType: "image/png", buffer: PNG });
  const tile = team.getByTestId("attachment").filter({ hasText: name });
  await expect(tile).toHaveAttribute("data-pending", "true");
  await expect(tile).toContainText("Uploading");
  await tile.evaluate((el) => (el.dataset.mark = "same-node")); // a remount would drop this

  await expect(tile).not.toHaveAttribute("data-pending", /.*/, { timeout: 15_000 });
  await expect(tile).toHaveAttribute("data-mark", "same-node");
  await expect(team.getByTestId("attachment").filter({ hasText: name })).toHaveCount(1);
  await expect(tile.locator("[data-phase]")).toHaveAttribute("data-phase", "done", { timeout: 15_000 });
  await expect(tile).toHaveAttribute("data-mark", "same-node");

  // Reopen the task: the file is saved now, so it lazy-loads behind a shimmer. The square reveal is only for a fresh upload.
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await openTask(page.getByTestId("task-row").first());
  const saved = page.getByTestId("task-drawer").getByTestId("team-attachments").getByTestId("attachment").filter({ hasText: name });
  await expect(saved).toBeVisible();
  await expect(saved.locator("[data-phase]")).toHaveCount(0);
  await expect(saved.locator("[data-state]")).toHaveCount(1);
  await expect(saved.locator("[data-state]")).toHaveAttribute("data-state", "loaded", { timeout: 15_000 });
  await expect(saved.locator("[data-phase]")).toHaveCount(0);

  // Leave the task as we found it.
  await saved.hover();
  await saved.getByRole("button", { name: `Remove ${name}` }).click();
  await expect(page.getByTestId("task-drawer").getByTestId("team-attachments").getByTestId("attachment").filter({ hasText: name })).toHaveCount(0);
});
