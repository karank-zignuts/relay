import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { apiError, internalError } from "@/lib/api-error";
import { authorize } from "@/lib/auth/authorize";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("api_keys.manage");
  if (auth.response) return auth.response;
  const { id } = await params;

  const { data, error } = await createAdminClient()
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null)
    .select("name")
    .maybeSingle();
  if (error) return internalError("revoke-api-key", error);
  if (!data) return apiError("KEY_NOT_FOUND", "API key not found or already revoked.", 404);

  await logActivity({ actor: auth.actor, action: "api_key.revoked", entityType: "api_key", entityId: id, summary: `Revoked API key “${data.name}”` });
  return NextResponse.json({ ok: true });
}
