import { test, expect } from "./fixtures";
import { asRole } from "./roles";

asRole("project_manager");

const background = (page: import("@playwright/test").Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("theme toggle in the account menu switches, persists and follows the system", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/tasks");
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/dark/);

  const pick = async (name: string) => {
    await page.getByRole("button", { name: /E2E project manager/ }).click();
    await page.getByRole("menuitem", { name: "Theme" }).click();
    await page.getByRole("menuitemradio", { name }).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
  };

  await pick("Dark");
  await expect(html).toHaveClass(/dark/);
  await expect.poll(() => background(page)).toBe("rgb(14, 14, 14)");
  await page.waitForTimeout(600);
  await page.screenshot({ path: process.env.THEME_SHOT ? `${process.env.THEME_SHOT}/tasks-dark.png` : undefined });

  await page.reload();
  await expect(html).toHaveClass(/dark/); // no flash: the class is there after load

  await pick("Light");
  await expect(html).not.toHaveClass(/dark/);

  await pick("System");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html).toHaveClass(/dark/);
});
