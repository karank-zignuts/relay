import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { apiError, emailError } from "@/lib/api-error";
import { authorize } from "@/lib/auth/authorize";
import { canManageRole } from "@/lib/auth/roles";
import { getAppUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Context) {
  const auth = await authorize("users.manage");
  if (auth.response) return auth.response;
  const { actor } = auth;
  const { id } = await params;

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("id, role, email, full_name").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!target) return apiError("USER_NOT_FOUND", "User not found.", 404);
  if (!canManageRole(actor.role, target.role)) return apiError("FORBIDDEN", "You cannot manage this user.", 403);

  const { data: authUser } = await admin.auth.admin.getUserById(id);
  if (!authUser.user) return apiError("USER_NOT_FOUND", "User not found.", 404);
  if (authUser.user.email_confirmed_at || authUser.user.last_sign_in_at) {
    return apiError("ALREADY_ACTIVE", "This user already accepted the invitation.", 409);
  }

  const { error } = await admin.auth.admin.inviteUserByEmail(target.email, {
    data: { full_name: target.full_name, role: target.role },
    redirectTo: `${getAppUrl()}/set-password`,
  });
  if (error) return emailError("resend-invite", error);

  await logActivity({ actor, action: "user.invite_resent", entityType: "user", entityId: id, summary: `Resent invitation to ${target.email}` });
  return NextResponse.json({ ok: true });
}
