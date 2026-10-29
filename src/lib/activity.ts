import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SessionUser } from "@/lib/auth/session";

type ActivityInput = {
  actor: SessionUser | null;
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
  details?: Record<string, string | number | boolean | null>;
};

/** For events the database cannot see itself (logins, user management). Task events are logged by DB triggers. */
export async function logActivity({ actor, action, entityType, entityId, summary, details }: ActivityInput) {
  const admin = createAdminClient();
  const { error } = await admin.from("activity_log").insert({
    actor_id: actor?.id ?? null,
    actor_label: actor ? actor.fullName || actor.email : "System",
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    summary,
    details: details ?? {},
  });
  if (error) console.error("[activity]", error.message);
}
