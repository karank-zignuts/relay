import { test, expect } from "./fixtures";
import { ROLES, authFile, type Role } from "./roles";

// Every role can open the task list and sees the sync status bar.
for (const role of Object.keys(ROLES) as Role[]) {
  test.describe(role, () => {
    test.use({ storageState: authFile(role) });

    test("tasks page loads", async ({ page }) => {
      await page.goto("/tasks");
      await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId("sync-status")).toBeVisible();
    });
  });
}
