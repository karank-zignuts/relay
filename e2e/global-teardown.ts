import { createClient } from "@supabase/supabase-js";

// Removes the tasks the suite created (soft delete, like the app does) so reruns start clean.
export default async function globalTeardown() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const now = new Date().toISOString();
  await admin.from("modules").update({ deleted_at: now }).like("name", "E2E%").is("deleted_at", null);
  await admin.from("tasks").update({ deleted_at: now }).eq("slack_channel_id", "C0E2ETEST").is("deleted_at", null);
  // Anything the suite wrote stays out of sight of real people: flag server-written activity the database could not (until the hide-test-data migration flags it itself).
  await admin.from("activity_log").update({ is_test: true }).eq("is_test", false).or('actor_label.like.E2E %,summary.like.%relay-e2e+%,summary.imatch."E2E (super admin|project manager|developer|tester)"');
  await admin.from("modules").update({ deleted_at: now }).like("name", "E2E%").is("deleted_at", null);
  await admin.from("tasks").update({ deleted_at: now }).or("title.like.E2E task %,title.like.RLS task %").is("deleted_at", null);
}
