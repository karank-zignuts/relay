// Optional: fills the app with realistic demo threads so you can see it populated.
//   npm run seed:demo          add demo tasks (channel id CDEMO0000)
//   npm run seed:demo -- --remove   soft-delete them again
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const CHANNEL = "CDEMO0000";

if (process.argv.includes("--remove")) {
  const { data: rows } = await admin.from("tasks").select("id").eq("slack_channel_id", CHANNEL).is("deleted_at", null);
  const { error } = await admin.from("tasks").update({ deleted_at: new Date().toISOString() }).eq("slack_channel_id", CHANNEL);
  if (error) throw error;
  console.log(`Removed ${rows?.length ?? 0} demo tasks.`);
  process.exit(0);
}

const hoursAgo = (h) => new Date(Date.now() - h * 3_600_000).toISOString();
let n = 0;
const ts = () => `${1790000000 + ++n}.${String(100000 + n)}`;
const t = (o) => {
  const thread_ts = ts();
  return { thread_ts, channel_id: CHANNEL, slack_url: `https://client.slack.com/archives/${CHANNEL}/p${thread_ts.replace(".", "")}`, ...o };
};

const parent = t({ title: "Revamp the invoice module", description: "Client wants the invoice list, PDF export and email delivery reworked before month end.", module: "Billing", priority: "high", status: "in_progress", tags: ["feature"], environments: ["local", "development"], changes_in: ["fe", "be"], task_date: hoursAgo(96), last_client_message_at: hoursAgo(30), last_team_reply_at: hoursAgo(28), jira_key: "BIL-214", jira_url: "https://example.atlassian.net/browse/BIL-214", jira_status: "In Progress" });
const items = [
  parent,
  t({ title: "Invoice PDF cuts off the last line item", description: "Reported on invoices with more than 12 lines. Screenshot attached in thread.", module: "Billing", priority: "urgent", status: "in_progress", tags: ["bug"], environments: ["local", "development", "staging"], changes_in: ["be"], parent_thread_ts: parent.thread_ts, task_date: hoursAgo(70), last_client_message_at: hoursAgo(5), last_team_reply_at: hoursAgo(20), jira_key: "BIL-221", jira_url: "https://example.atlassian.net/browse/BIL-221", jira_status: "In Review" }),
  t({ title: "Add CSV export to invoice list", module: "Billing", priority: "medium", status: "to_do", tags: ["feature"], changes_in: ["fe", "be"], parent_thread_ts: parent.thread_ts, task_date: hoursAgo(66) }),
  t({ title: "Login fails on Safari 17 after password reset", description: "Client's finance lead cannot sign in after resetting the password. Works in Chrome.", module: "Auth", priority: "urgent", status: "blocked", tags: ["bug"], environments: ["local"], changes_in: ["fe"], task_date: hoursAgo(52), last_client_message_at: hoursAgo(2), last_team_reply_at: hoursAgo(40) }),
  t({ title: "Can we show the dispatch status on the dashboard?", description: "Suggestion from the ops team. Nice to have, no deadline.", module: "Dashboard", priority: "low", status: "backlog", tags: ["suggestion"], task_date: hoursAgo(120), last_client_message_at: hoursAgo(118) }),
  t({ title: "Rename 'Clients' to 'Accounts' across the app", module: "Navigation", priority: "low", status: "done", tags: ["suggestion"], environments: ["local", "development", "staging", "production"], changes_in: ["fe"], task_date: hoursAgo(200), last_client_message_at: hoursAgo(190), last_team_reply_at: hoursAgo(188) }),
  t({ title: "Monthly report emails arrive twice", description: "Both at 08:00 and 08:01. Looks like the cron runs on two instances.", module: "Reports", priority: "high", status: "in_review", tags: ["bug"], environments: ["local", "development"], changes_in: ["be", "devops"], task_date: hoursAgo(44), last_client_message_at: hoursAgo(9), last_team_reply_at: hoursAgo(8), jira_key: "REP-87", jira_url: "https://example.atlassian.net/browse/REP-87", jira_status: "Done" }),
  t({ title: "Need role 'Auditor' with read-only access", description: "Compliance asks for an auditor role that can see invoices and logs but change nothing.", module: "Auth", priority: "medium", status: "to_do", tags: ["feature"], changes_in: ["be", "db"], task_date: hoursAgo(30), last_client_message_at: hoursAgo(26) }),
  t({ title: "Dark mode for the customer portal", module: "Portal", priority: "low", status: "backlog", tags: ["suggestion"], task_date: hoursAgo(300), last_client_message_at: hoursAgo(290), last_team_reply_at: hoursAgo(288) }),
  t({ title: "Search is slow with more than 5,000 records", module: "Search", priority: "high", status: "in_progress", tags: ["bug", "performance"], environments: ["local", "development"], changes_in: ["be", "db"], task_date: hoursAgo(25), last_client_message_at: hoursAgo(1), last_team_reply_at: hoursAgo(1) }),
  t({ title: "Update footer copyright and support email", module: "Portal", priority: "low", status: "done", tags: ["chore"], environments: ["local", "development", "staging", "production"], changes_in: ["fe"], task_date: hoursAgo(150) }),
  t({ title: "Webhook retries should back off", module: "Integrations", priority: "medium", status: "to_do", tags: ["improvement"], changes_in: ["be"], task_date: hoursAgo(18), last_client_message_at: hoursAgo(16), last_team_reply_at: hoursAgo(15) }),
];

const { data, error } = await admin.rpc("sync_threads", { p_items: items, p_actor: "demo seed", p_api_key_id: null });
if (error) throw error;
console.log(data);

// Give a few tasks assignees so the table shows people.
const { data: team } = await admin.from("profiles").select("id, role").eq("is_active", true).is("deleted_at", null);
const people = team?.map((p) => p.id) ?? [];
const { data: tasks } = await admin.from("tasks").select("id").eq("slack_channel_id", CHANNEL).limit(8);
for (const [i, task] of (tasks ?? []).entries()) {
  const picks = people.slice(0, 1 + (i % 3));
  await admin.from("task_assignees").upsert(picks.map((user_id) => ({ task_id: task.id, user_id })), { onConflict: "task_id,user_id", ignoreDuplicates: true });
}
console.log("Demo data added. Remove with: npm run seed:demo -- --remove");
