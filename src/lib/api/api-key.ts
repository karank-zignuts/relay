import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { apiError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";

const KEY_PREFIX = "rly_";

export const hashApiKey = (key: string) => createHash("sha256").update(key).digest("hex");

/** The full key is shown once on creation. Only its hash is stored. */
export function generateApiKey() {
  const key = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { key, prefix: key.slice(0, 12), hash: hashApiKey(key) };
}

type Verified = { apiKey: { id: string; name: string }; response?: never } | { apiKey?: never; response: Response };

/** Guard for /api/v1. Expects `Authorization: Bearer rly_…`. */
export async function verifyApiKey(request: Request): Promise<Verified> {
  const header = request.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!key.startsWith(KEY_PREFIX)) {
    return { response: apiError("UNAUTHENTICATED", "Send an API key as 'Authorization: Bearer rly_…'.", 401) };
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("api_keys")
    .select("id, name")
    .eq("key_hash", hashApiKey(key))
    .is("revoked_at", null)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) return { response: apiError("UNAUTHENTICATED", "This API key is invalid or has been revoked.", 401) };

  await admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return { apiKey: data };
}
