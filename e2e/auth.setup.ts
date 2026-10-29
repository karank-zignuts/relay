import { test as setup, expect } from "@playwright/test";
import { ROLES, authFile, type Role } from "./roles";

// Logs in once per role; specs reuse the saved sessions (no login steps, no tokens spent).
for (const role of Object.keys(ROLES) as Role[]) {
  setup(`log in as ${role}`, async ({ page }) => {
    setup.setTimeout(120_000); // first login waits on the dev server compiling the post-login route
    const email = process.env[ROLES[role]];
    const password = process.env.E2E_PASSWORD;
    if (!email || !password) throw new Error(`Set ${ROLES[role]} and E2E_PASSWORD in .env.e2e`);

    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/tasks/, { timeout: 90_000 });
    await page.context().storageState({ path: authFile(role) });
  });
}
