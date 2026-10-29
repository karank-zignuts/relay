import { createClient } from "@supabase/supabase-js";

// Removes the tasks the suite created (soft delete, like the app does) so reruns start clean.
export default async function globalTeardown() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const now = new Date().toISOString();
  await admin.from("tasks").update({ deleted_at: now }).eq("slack_channel_id", "C0E2ETEST").is("deleted_at", null);
  await admin.from("tasks").update({ deleted_at: now }).or("title.like.E2E task %,title.like.RLS task %").is("deleted_at", null);
}
