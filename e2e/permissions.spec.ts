import { test, expect } from "./fixtures";
import { ROLES, authFile, type Role } from "./roles";

// What each role may see. The same rules are enforced by the server and RLS (see rls.spec.ts).
const NAV: Record<Role, { visible: string[]; hidden: string[] }> = {
  super_admin: { visible: ["Tasks", "Board", "Needs attention", "Activity", "Users", "Settings"], hidden: [] },
  project_manager: { visible: ["Tasks", "Board", "Needs attention", "Activity", "Users"], hidden: ["Settings"] },
  developer: { visible: ["Tasks", "Board", "Needs attention"], hidden: ["Activity", "Users", "Settings"] },
  tester: { visible: ["Tasks", "Board", "Needs attention"], hidden: ["Activity", "Users", "Settings"] },
};

for (const role of Object.keys(ROLES) as Role[]) {
  test.describe(role, () => {
    test.use({ storageState: authFile(role) });

    test("sees the right navigation", async ({ page }) => {
      await page.goto("/tasks");
      const nav = page.getByRole("navigation", { name: "Main" });
      await expect(nav.getByRole("link", { name: "Tasks" })).toBeVisible({ timeout: 45_000 });
      for (const label of NAV[role].visible) await expect(nav.getByRole("link", { name: new RegExp(`^${label}`) })).toBeVisible();
      for (const label of NAV[role].hidden) await expect(nav.getByRole("link", { name: label })).toHaveCount(0);
    });

    test("is bounced from pages above their role", async ({ page }) => {
      for (const [path, allowed] of [
        ["/users", role === "super_admin" || role === "project_manager"],
        ["/activity", role === "super_admin" || role === "project_manager"],
        ["/settings", role === "super_admin"],
      ] as const) {
        await page.goto(path);
        if (allowed) await expect(page).toHaveURL(new RegExp(path));
        else await expect(page).toHaveURL(/\/tasks/);
      }
    });

    test("user API refuses roles that cannot manage users", async ({ request }) => {
      // An empty body: managers get past authorization and fail validation (422), others are refused (403).
      // No email is ever sent, so this never touches the mail rate limit.
      const response = await request.post("/api/users", { data: {} });
      const manages = role === "super_admin" || role === "project_manager";
      expect(response.status()).toBe(manages ? 422 : 403);
    });
  });
}
