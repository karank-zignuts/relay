import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { apiError, internalError, validationError } from "@/lib/api-error";
import { authorize } from "@/lib/auth/authorize";
import { canManageRole, ROLE_LABELS } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateUserSchema } from "@/features/users/schemas";

type Context = { params: Promise<{ id: string }> };

const LAST_SUPER_ADMIN = "23514";
const UNIQUE_VIOLATION = "23505";

export async function PATCH(request: Request, { params }: Context) {
  const auth = await authorize("users.manage");
  if (auth.response) return auth.response;
  const { actor } = auth;
  const { id } = await params;

  const parsed = updateUserSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  const { fullName, role, slackUserId, isActive } = parsed.data;

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("id, role, email").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!target) return apiError("USER_NOT_FOUND", "User not found.", 404);

  if (!canManageRole(actor.role, target.role)) {
    return apiError("FORBIDDEN", "You cannot manage this user.", 403);
  }
  if (role && !canManageRole(actor.role, role)) {
    return apiError("FORBIDDEN", `You cannot assign the ${ROLE_LABELS[role]} role.`, 403);
  }
  if (id === actor.id && (role !== undefined || isActive !== undefined)) {
    return apiError("FORBIDDEN", "You cannot change your own role or status.", 403);
  }

  const { error } = await admin
    .from("profiles")
    .update({
      ...(fullName !== undefined && { full_name: fullName }),
      ...(role !== undefined && { role }),
      ...(slackUserId !== undefined && { slack_user_id: slackUserId || null }),
      ...(isActive !== undefined && { is_active: isActive }),
    })
    .eq("id", id);

  if (error) {
    if (error.code === LAST_SUPER_ADMIN) return apiError("LAST_SUPER_ADMIN", error.message, 409);
    if (error.code === UNIQUE_VIOLATION) return apiError("SLACK_ID_TAKEN", "That Slack ID is already linked to another user.", 409);
    return internalError("update-user", error);
  }

  if (isActive !== undefined) {
    await admin.auth.admin.updateUserById(id, { ban_duration: isActive ? "none" : "876000h" });
  }

  await logActivity({
    actor,
    action: "user.updated",
    entityType: "user",
    entityId: id,
    summary: `Updated ${target.email} (${Object.keys(parsed.data).join(", ")})`,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Context) {
  const auth = await authorize("users.manage");
  if (auth.response) return auth.response;
  const { actor } = auth;
  const { id } = await params;

  if (id === actor.id) return apiError("FORBIDDEN", "You cannot delete your own account.", 403);

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("id, role, email").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!target) return apiError("USER_NOT_FOUND", "User not found.", 404);
  if (!canManageRole(actor.role, target.role)) return apiError("FORBIDDEN", "You cannot manage this user.", 403);

  const { error } = await admin.from("profiles").update({ deleted_at: new Date().toISOString(), is_active: false }).eq("id", id);
  if (error) {
    if (error.code === LAST_SUPER_ADMIN) return apiError("LAST_SUPER_ADMIN", error.message, 409);
    return internalError("delete-user", error);
  }

  // Soft delete: the auth user is banned, never removed, so history stays attributable.
  await admin.auth.admin.updateUserById(id, { ban_duration: "876000h" });
  await admin.from("task_assignees").delete().eq("user_id", id);

  await logActivity({ actor, action: "user.deleted", entityType: "user", entityId: id, summary: `Deleted user ${target.email}` });
  return NextResponse.json({ ok: true });
}
