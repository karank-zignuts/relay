import { test, expect } from "./fixtures";
import { authFile } from "./roles";
import { bearer, createApiKey, syncItem } from "./helpers";

test.use({ storageState: authFile("super_admin") });
test.describe.configure({ mode: "serial" });

let key = "";
let revoke: () => Promise<unknown>;

test.beforeAll(async ({ playwright, baseURL }) => {
  const context = await playwright.request.newContext({ baseURL, storageState: authFile("super_admin") });
  const created = await createApiKey(context);
  key = created.key;
  revoke = created.revoke;
});

test.afterAll(async () => {
  await revoke?.();
});

const post = (request: import("@playwright/test").APIRequestContext, items: unknown[]) =>
  request.post("/api/v1/sync", { headers: bearer(key), data: { items } });

test("rejects an invalid payload with a clear error", async ({ request }) => {
  const response = await post(request, [{ thread_ts: "nope", channel_id: "C1", title: "" }]);
  expect(response.status()).toBe(422);
  expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
});

test("rejects a wrong key", async ({ request }) => {
  const response = await request.post("/api/v1/sync", { headers: bearer("rly_wrong"), data: { items: [syncItem()] } });
  expect(response.status()).toBe(401);
});

test("creates a task, then the same payload again changes nothing", async ({ request }) => {
  const item = syncItem({ priority: "high", module: "Billing", tags: ["bug"], last_client_message_at: new Date().toISOString() });

  const first = await (await post(request, [item])).json();
  expect(first).toMatchObject({ status: "success", created: 1, updated: 0, failed: 0 });

  const again = await (await post(request, [item])).json();
  expect(again).toMatchObject({ created: 0, updated: 0, unchanged: 1, failed: 0 });

  const listed = await (await request.get(`/api/v1/tasks?thread_ts=${item.thread_ts}`, { headers: bearer(key) })).json();
  expect(listed.items).toHaveLength(1);
  expect(listed.items[0]).toMatchObject({ title: item.title, priority: "high", module: "Billing" });
});

test("new client activity updates the same task instead of duplicating it", async ({ request }) => {
  const item = syncItem({ last_client_message_at: "2026-10-20T10:00:00Z" });
  await post(request, [item]);

  const result = await (await post(request, [{ ...item, last_client_message_at: "2026-10-21T10:00:00Z", last_team_reply_at: "2026-10-21T11:00:00Z" }])).json();
  expect(result).toMatchObject({ created: 0, updated: 1 });

  const listed = await (await request.get(`/api/v1/tasks?thread_ts=${item.thread_ts}`, { headers: bearer(key) })).json();
  expect(listed.items).toHaveLength(1);
  expect(listed.items[0].last_team_reply_at).toBe("2026-10-21T11:00:00+00:00");
});

test("one invalid item rejects the whole batch and imports nothing", async ({ request }) => {
  const good = syncItem();
  const bad = syncItem({ task_date: "2026-13-45T00:00:00Z" });
  const response = await post(request, [good, bad]);
  expect(response.status()).toBe(422);

  const listed = await (await request.get(`/api/v1/tasks?thread_ts=${good.thread_ts}`, { headers: bearer(key) })).json();
  expect(listed.items).toHaveLength(0);
});

test("links sub-tasks through parent_thread_ts", async ({ request }) => {
  const parent = syncItem();
  const child = syncItem({ parent_thread_ts: parent.thread_ts });
  await post(request, [parent]);
  await post(request, [child]);

  const parentRow = (await (await request.get(`/api/v1/tasks?thread_ts=${parent.thread_ts}`, { headers: bearer(key) })).json()).items[0];
  expect(parentRow).toBeTruthy();
});

test("latest sync run and user mapping endpoints respond", async ({ request }) => {
  const run = await (await request.get("/api/v1/sync-runs/latest", { headers: bearer(key) })).json();
  expect(run.last_finished_at).toBeTruthy();
  const users = await (await request.get("/api/v1/users", { headers: bearer(key) })).json();
  expect(users.items.length).toBeGreaterThan(0);
});

test("a revoked key stops working", async ({ playwright, baseURL }) => {
  const context = await playwright.request.newContext({ baseURL, storageState: authFile("super_admin") });
  const temporary = await createApiKey(context);
  await temporary.revoke();
  const response = await context.get("/api/v1/tasks", { headers: bearer(temporary.key) });
  expect(response.status()).toBe(401);
});

test("a person's edit survives the next sync", async ({ page, request }) => {
  const item = syncItem({ title: "Original client wording" });
  await post(request, [item]);

  await page.goto("/tasks");
  await page.getByLabel("Search tasks").fill("Original client wording");
  await page.getByTestId("task-row").filter({ hasText: "Original client wording" }).click();
  await page.getByLabel("Title").fill("Edited by the team");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Task saved")).toBeVisible();

  const result = await (await post(request, [{ ...item, title: "Client reworded it again" }])).json();
  expect(result.failed).toBe(0);
  const listed = await (await request.get(`/api/v1/tasks?thread_ts=${item.thread_ts}`, { headers: bearer(key) })).json();
  expect(listed.items[0].title).toBe("Edited by the team");
  expect(listed.items[0].human_edited_fields).toContain("title");
});
