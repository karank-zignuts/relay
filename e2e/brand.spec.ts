import { test, expect } from "./fixtures";
import { asRole } from "./roles";

test.describe("brand, signed out", () => {
  test("sign-in shows the logo, and the icons and manifest are served", async ({ page, request }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Relay" }).first()).toBeVisible();
    await expect(page.locator('link[rel="icon"][href*="icon.svg"]')).toHaveCount(1);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);

    // Content type matters: a redirect to the sign-in page would also answer 200.
    const served: [string, RegExp][] = [["/icon.svg", /svg/], ["/apple-icon.png", /png/], ["/favicon.ico", /icon/], ["/icons/icon-512.png", /png/], ["/brand/relay-logo.png", /png/]];
    for (const [url, type] of served) {
      const res = await request.get(url);
      expect(res.status(), url).toBe(200);
      expect(res.headers()["content-type"], url).toMatch(type);
    }
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.theme_color).toBe("#ff4704");
  });
});

test.describe("brand, signed in", () => {
  asRole("project_manager");

  test("the nav carries the logo and an Ember marker on the current page", async ({ page }) => {
    await page.goto("/tasks");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Tasks" })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole("link", { name: "Relay, go to tasks" })).toBeVisible();
    const marker = await nav.getByRole("link", { name: "Tasks" }).evaluate((el) => getComputedStyle(el, "::after").backgroundColor);
    expect(marker).toBe("rgb(255, 71, 4)");
  });
});
