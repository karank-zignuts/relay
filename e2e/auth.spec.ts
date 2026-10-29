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

  test("an invalid set-password link explains itself and points to sign in", async ({ page }) => {
    await page.goto("/set-password");
    await expect(page.getByRole("heading", { name: "This link was already used" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: "Go to sign in" })).toBeVisible();
  });

  test("a link Supabase already rejected shows the used-link message at once", async ({ page }) => {
    await page.goto("/set-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
    await expect(page.getByRole("heading", { name: "This link was already used" })).toBeVisible();
  });

  test("a token_hash link waits for Continue and does not consume the token on load", async ({ page }) => {
    await page.goto("/set-password?token_hash=not-a-real-token&type=invite");
    await expect(page.getByRole("heading", { name: "Accept your invitation" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "This link was already used" })).toBeVisible();
  });

  test("sign-in shows the welcome notice after a password is set", async ({ page }) => {
    await page.goto("/login?notice=welcome");
    await expect(page.getByTestId("login-notice")).toContainText("Your password is set");
  });

  test("the v1 API refuses requests without a key", async ({ request }) => {
    const response = await request.get("/api/v1/tasks");
    expect(response.status()).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
  });
});
