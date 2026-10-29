import "server-only";
import { apiError } from "@/lib/api-error";
import { can, type Permission } from "@/lib/auth/roles";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";

type Authorized = { actor: SessionUser; response?: never } | { actor?: never; response: Response };

/** Route-handler guard. Roles are also enforced by RLS, this gives clean 401/403 errors. */
export async function authorize(permission: Permission): Promise<Authorized> {
  const actor = await getSessionUser();
  if (!actor) return { response: apiError("UNAUTHENTICATED", "Sign in to continue.", 401) };
  if (!can(actor.role, permission)) {
    return { response: apiError("FORBIDDEN", "You do not have permission to do this.", 403) };
  }
  return { actor };
}
