import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { verifyApiKey } from "@/lib/api/api-key";
import { createAdminClient } from "@/lib/supabase/admin";

// Claude reads `last_finished_at` to know where the previous sync stopped.
export async function GET(request: Request) {
  const verified = await verifyApiKey(request);
  if (verified.response) return verified.response;

  const { data, error } = await createAdminClient()
    .from("sync_runs")
    .select("id, status, started_at, finished_at, created_count, updated_count, unchanged_count, failed_count")
    .in("status", ["success", "partial"])
    .is("deleted_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return internalError("api-latest-sync", error);

  return NextResponse.json({ run: data, last_finished_at: data?.finished_at ?? null });
}
