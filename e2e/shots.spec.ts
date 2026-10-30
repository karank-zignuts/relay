import { test } from "@playwright/test";
import { asRole } from "./roles";
import { openTask } from "./helpers";

// Visual review only. Run with: E2E_SHOTS=1 npx playwright test e2e/shots.spec.ts
test.skip(!process.env.E2E_SHOTS, "set E2E_SHOTS=1");
asRole("super_admin");
test.use({ viewport: { width: 1440, height: 900 } });

test("screenshots", async ({ page, browser }) => {
  const shot = (name: string) => page.screenshot({ path: `test-results/shots/${name}.png` });
  await page.goto("/tasks");
  await page.getByTestId("task-row").first().waitFor({ timeout: 45_000 });
  await page.waitForTimeout(600);
  await shot("tasks");
  await openTask(page.getByTestId("task-row").nth(1));
  await page.getByTestId("task-drawer").waitFor();
  await page.waitForTimeout(600);
  await shot("drawer");
  await page.keyboard.press("Escape");
  await page.goto("/board");
  await page.getByTestId("kanban-card").first().waitFor();
  await page.waitForTimeout(500);
  await shot("board");
  await page.goto("/attention");
  await page.getByTestId("attention-row").first().waitFor();
  await page.waitForTimeout(400);
  await shot("attention");
  await page.goto("/users");
  await page.getByTestId("user-row").first().waitFor();
  await shot("users");
  const anon = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: { cookies: [], origins: [] } });
  const login = await anon.newPage();
  await login.goto("/login");
  await login.waitForTimeout(500);
  await login.screenshot({ path: "test-results/shots/login.png" });
});
