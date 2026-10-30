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

// Anything about a test account or a test API key is test data, even when a real person is the one acting (e.g. deleting a test user).
const TEST_SUMMARY = /relay-e2e\+[^@\s]*@example\.com|(^|[^\w])e2e-/i;

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
    is_test: Boolean(actor?.isTest) || TEST_SUMMARY.test(summary),
  });
  if (error) console.error("[activity]", error.message);
}
