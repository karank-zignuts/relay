import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { apiError, emailError, internalError, validationError } from "@/lib/api-error";
import { authorize } from "@/lib/auth/authorize";
import { canManageRole, ROLE_LABELS } from "@/lib/auth/roles";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteUserSchema } from "@/features/users/schemas";

export async function POST(request: Request) {
  const auth = await authorize("users.manage");
  if (auth.response) return auth.response;
  const { actor } = auth;

  const parsed = inviteUserSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  const { email, fullName, role, slackUserId } = parsed.data;

  if (!canManageRole(actor.role, role)) {
    return apiError("FORBIDDEN", `You cannot invite a ${ROLE_LABELS[role]}.`, 403);
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, role },
    redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/set-password`,
  });

  if (error || !data.user) {
    if (error?.message.toLowerCase().includes("already")) {
      return apiError("USER_EXISTS", "A user with this email already exists.", 409);
    }
    return emailError("invite-user", error ?? { message: "No user returned" });
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ slack_user_id: slackUserId || null, created_by: actor.id })
    .eq("id", data.user.id);
  if (profileError) {
    const duplicate = profileError.code === "23505";
    return duplicate
      ? apiError("SLACK_ID_TAKEN", "That Slack ID is already linked to another user. The invite was sent without it.", 409)
      : internalError("invite-user-profile", profileError);
  }

  await logActivity({
    actor,
    action: "user.invited",
    entityType: "user",
    entityId: data.user.id,
    summary: `Invited ${email} as ${ROLE_LABELS[role]}`,
  });

  return NextResponse.json({ id: data.user.id }, { status: 201 });
}
