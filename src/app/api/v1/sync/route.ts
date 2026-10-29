import { NextResponse } from "next/server";
import { internalError, validationError } from "@/lib/api-error";
import { verifyApiKey } from "@/lib/api/api-key";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncRequestSchema } from "@/features/sync/schemas";

// One batch = one transaction per thread and one sync run. Safe to send the same payload twice.
export async function POST(request: Request) {
  const verified = await verifyApiKey(request);
  if (verified.response) return verified.response;

  const parsed = syncRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);

  const { data, error } = await createAdminClient().rpc("sync_threads", {
    p_items: parsed.data.items,
    p_actor: verified.apiKey.name,
    p_api_key_id: verified.apiKey.id,
  });
  if (error) return internalError("sync", error);

  return NextResponse.json(data);
}
