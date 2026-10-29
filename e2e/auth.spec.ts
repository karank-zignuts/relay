import { test, expect } from "./fixtures";

test.describe("signed out", () => {
  test("is redirected to the sign-in page", async ({ page }) => {
    await page.goto("/tasks");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("shows an error for a wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(process.env.E2E_TESTER_EMAIL!);
    await page.getByPlaceholder("Password", { exact: true }).fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("forgot password gives the same answer for any email", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(`nobody-${Date.now()}@example.com`);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toContainText("If an account exists");
  });

  test("an invalid set-password link explains itself", async ({ page }) => {
    await page.goto("/set-password");
    await expect(page.getByRole("heading", { name: "Link expired" })).toBeVisible({ timeout: 15_000 });
  });

  test("the v1 API refuses requests without a key", async ({ request }) => {
    const response = await request.get("/api/v1/tasks");
    expect(response.status()).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
  });
});
