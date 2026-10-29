import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { verifyApiKey } from "@/lib/api/api-key";
import { createAdminClient } from "@/lib/supabase/admin";

// Lets Claude see which Slack member IDs are mapped to team members.
export async function GET(request: Request) {
  const verified = await verifyApiKey(request);
  if (verified.response) return verified.response;

  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, full_name, email, role, slack_user_id")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("full_name");
  if (error) return internalError("api-list-users", error);

  return NextResponse.json({ items: data });
}
