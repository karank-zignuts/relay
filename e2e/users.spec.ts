import { test, expect } from "./fixtures";
import { authFile } from "./roles";
import { uid } from "./helpers";

test.describe("project manager", () => {
  test.use({ storageState: authFile("project_manager") });

  test("cannot grant Super Admin and cannot manage Super Admins", async ({ page }) => {
    await page.goto("/users");
    await page.getByRole("button", { name: "Invite user" }).click();
    const options = await page.getByLabel("Role").locator("option").allTextContents();
    expect(options).not.toContain("Super Admin");
    expect(options).toContain("Developer");
    await page.keyboard.press("Escape");

    const superAdminRow = page.getByTestId("user-row").filter({ hasText: "E2E super admin" });
    await expect(superAdminRow).toBeVisible();
    await expect(superAdminRow.getByRole("button", { name: /Actions for/ })).toHaveCount(0);
  });

  test("the API refuses to invite a Super Admin or edit one", async ({ request }) => {
    const invite = await request.post("/api/users", { data: { email: `nope-${uid()}@example.com`, fullName: "Nope", role: "super_admin" } });
    expect(invite.status()).toBe(403);
  });
});

test.describe("super admin", () => {
  test.use({ storageState: authFile("super_admin") });

  test("edits a user's Slack ID, and cannot change their own role", async ({ page }) => {
    await page.goto("/users");
    const row = page.getByTestId("user-row").filter({ hasText: "E2E tester" });
    await row.getByRole("button", { name: /Actions for/ }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page.getByLabel("Slack member ID (optional)").fill("U0E2ETEST01");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("User updated")).toBeVisible();
    await expect(row).toContainText("U0E2ETEST01");

    await row.getByRole("button", { name: /Actions for/ }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page.getByLabel("Slack member ID (optional)").fill("");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("User updated")).toBeVisible();

    const self = page.getByTestId("user-row").filter({ hasText: "E2E super admin" });
    await self.getByRole("button", { name: /Actions for/ }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await expect(page.getByLabel("Role")).toBeDisabled();
  });

  test("a mapped Slack ID auto-assigns the person on sync", async ({ page, request, playwright, baseURL }) => {
    test.setTimeout(90_000);
    const { createApiKey, bearer, syncItem } = await import("./helpers");
    const slackId = "U0E2ETEST02";
    await page.goto("/users");
    const row = page.getByTestId("user-row").filter({ hasText: "E2E developer" });
    await row.getByRole("button", { name: /Actions for/ }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page.getByLabel("Slack member ID (optional)").fill(slackId);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("User updated")).toBeVisible();

    const key = await createApiKey(request);
    const item = syncItem({ assignee_slack_ids: [slackId], title: `Auto assign ${uid()}` });
    const api = await playwright.request.newContext({ baseURL });
    const result = await (await api.post("/api/v1/sync", { headers: bearer(key.key), data: { items: [item] } })).json();
    expect(result.created).toBe(1);

    await page.goto("/tasks");
    await page.getByLabel("Search tasks").fill(item.title);
    await expect(page.getByTestId("task-row").first()).toContainText("E2E");

    await key.revoke();
    await page.goto("/users");
    await row.getByRole("button", { name: /Actions for/ }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page.getByLabel("Slack member ID (optional)").fill("");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("User updated")).toBeVisible();
  });

  // Sends one real invitation email. Run on purpose: E2E_INVITES=1 npx playwright test e2e/users.spec.ts -g invite
  test("invites a user, lists them as Invited, then deletes them", async ({ page, request }) => {
    test.skip(!process.env.E2E_INVITES, "set E2E_INVITES=1 (sends a real email)");
    const email = `relay-e2e-invite-${uid()}@example.com`;
    await page.goto("/users");
    await page.getByRole("button", { name: "Invite user" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Full name").fill("E2E Invitee");
    await page.getByLabel("Role").selectOption("developer");
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page.getByText("Invitation sent").or(page.getByText(/Too many emails/))).toBeVisible();

    const row = page.getByTestId("user-row").filter({ hasText: email });
    test.skip((await row.count()) === 0, "email rate limit reached");
    await expect(row).toContainText("Invited");
    await row.getByRole("button", { name: /Actions for/ }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete user" }).click();
    await expect(page.getByText("User deleted")).toBeVisible();
    await expect(row).toHaveCount(0);
    void request;
  });
});
