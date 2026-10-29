import { test, expect } from "@playwright/test";
import { clientAs, uid } from "./helpers";

// Talks to the database directly as each role, so it proves RLS and triggers, not just the UI.
test.describe.configure({ mode: "serial" });

let taskId = "";
let otherTaskId = "";
const title = `RLS task ${uid()}`;

test.beforeAll(async () => {
  const pm = await clientAs("project_manager");
  const dev = await clientAs("developer");
  const made = await pm.supabase.from("tasks").insert([{ title, created_by: pm.userId }, { title: `${title} other`, created_by: pm.userId }]).select("id, title").order("title");
  expect(made.error).toBeNull();
  taskId = made.data![0].id;
  otherTaskId = made.data![1].id;
  const assigned = await pm.supabase.from("task_assignees").insert({ task_id: taskId, user_id: dev.userId });
  expect(assigned.error).toBeNull();
});

test.afterAll(async () => {
  const pm = await clientAs("project_manager");
  for (const id of [taskId, otherTaskId]) if (id) await pm.supabase.rpc("delete_task", { p_task_id: id });
});

test("developer and tester cannot create tasks", async () => {
  for (const role of ["developer", "tester"] as const) {
    const { supabase } = await clientAs(role);
    const { error } = await supabase.from("tasks").insert({ title: "Nope" });
    expect(error, role).not.toBeNull();
  }
});

test("developer can edit an assigned task but not an unassigned one", async () => {
  const { supabase } = await clientAs("developer");
  const own = await supabase.from("tasks").update({ priority: "high" }).eq("id", taskId).select("id");
  expect(own.error).toBeNull();
  expect(own.data).toHaveLength(1);

  const other = await supabase.from("tasks").update({ priority: "high" }).eq("id", otherTaskId).select("id");
  expect(other.data ?? []).toHaveLength(0);
});

test("developer cannot change Slack fields or delete", async () => {
  const { supabase } = await clientAs("developer");
  const slack = await supabase.from("tasks").update({ slack_url: "https://evil.example" }).eq("id", taskId);
  expect(slack.error).not.toBeNull();
  const del = await supabase.rpc("delete_task", { p_task_id: taskId });
  expect(del.error).not.toBeNull();
});

test("tester can change status only", async () => {
  const { supabase } = await clientAs("tester");
  const status = await supabase.from("tasks").update({ status: "in_review" }).eq("id", taskId).select("id");
  expect(status.error).toBeNull();
  expect(status.data).toHaveLength(1);

  const edit = await supabase.from("tasks").update({ title: "Hacked" }).eq("id", taskId);
  expect(edit.error).not.toBeNull();
  const del = await supabase.rpc("delete_task", { p_task_id: taskId });
  expect(del.error).not.toBeNull();
});

test("only admins change assignees", async () => {
  const { supabase, userId } = await clientAs("developer");
  const add = await supabase.from("task_assignees").insert({ task_id: otherTaskId, user_id: userId });
  expect(add.error).not.toBeNull();
});

test("everyone can comment, but only as themselves", async () => {
  for (const role of ["developer", "tester"] as const) {
    const { supabase, userId } = await clientAs(role);
    const ok = await supabase.from("task_comments").insert({ task_id: taskId, author_id: userId, body: `hi from ${role}` });
    expect(ok.error, role).toBeNull();
  }
  const { supabase } = await clientAs("tester");
  const dev = await clientAs("developer");
  const forged = await supabase.from("task_comments").insert({ task_id: taskId, author_id: dev.userId, body: "forged" });
  expect(forged.error).not.toBeNull();
});

test("human edits are tracked so a sync cannot overwrite them", async () => {
  const pm = await clientAs("project_manager");
  await pm.supabase.from("tasks").update({ title: `${title} edited` }).eq("id", taskId);
  const { data } = await pm.supabase.from("tasks").select("human_edited_fields").eq("id", taskId).single();
  expect(data!.human_edited_fields).toEqual(expect.arrayContaining(["title", "priority", "status"]));
});

test("activity log is readable by admins only", async () => {
  const pm = await clientAs("project_manager");
  const allowed = await pm.supabase.from("activity_log").select("id").limit(1);
  expect(allowed.error).toBeNull();
  expect(allowed.data!.length).toBeGreaterThan(0);

  for (const role of ["developer", "tester"] as const) {
    const { supabase } = await clientAs(role);
    const { data } = await supabase.from("activity_log").select("id").limit(1);
    expect(data ?? [], role).toHaveLength(0);
  }
});

test("nobody can read API keys or write the activity log from the client", async () => {
  const sa = await clientAs("super_admin");
  const keys = await sa.supabase.from("api_keys").select("id").limit(1);
  expect(keys.data ?? []).toHaveLength(0);
  const write = await sa.supabase.from("activity_log").insert({ actor_label: "x", action: "x", entity_type: "x", summary: "forged" });
  expect(write.error).not.toBeNull();
});

test("profile privileges cannot be self-escalated", async () => {
  const { supabase, userId } = await clientAs("tester");
  const escalate = await supabase.from("profiles").update({ role: "super_admin" }).eq("id", userId);
  expect(escalate.error).not.toBeNull();
  const own = await supabase.from("profiles").update({ full_name: "E2E tester" }).eq("id", userId);
  expect(own.error).toBeNull();
});

test("only a Super Admin can change settings", async () => {
  const pm = await clientAs("project_manager");
  const denied = await pm.supabase.from("app_settings").update({ forgotten_reply_hours: 9 }).eq("id", true).select("id");
  expect(denied.data ?? []).toHaveLength(0);
});
