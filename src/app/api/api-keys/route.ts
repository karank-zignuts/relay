import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { internalError, validationError } from "@/lib/api-error";
import { generateApiKey } from "@/lib/api/api-key";
import { authorize } from "@/lib/auth/authorize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createApiKeySchema } from "@/features/settings/schemas";

export async function POST(request: Request) {
  const auth = await authorize("api_keys.manage");
  if (auth.response) return auth.response;

  const parsed = createApiKeySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);

  const { key, prefix, hash } = generateApiKey();
  const { data, error } = await createAdminClient()
    .from("api_keys")
    .insert({ name: parsed.data.name, key_prefix: prefix, key_hash: hash, created_by: auth.actor.id })
    .select("id")
    .single();
  if (error) return internalError("create-api-key", error);

  await logActivity({ actor: auth.actor, action: "api_key.created", entityType: "api_key", entityId: data.id, summary: `Created API key “${parsed.data.name}”` });
  // The only time the full key is ever returned.
  return NextResponse.json({ id: data.id, key }, { status: 201 });
}
