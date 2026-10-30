import { redirect } from "next/navigation";
import { can } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { SHOW_TEST_USERS } from "@/features/users/test-users";
import { createAdminClient } from "@/lib/supabase/admin";
import { UsersTable, type ManagedUser } from "./users-table";

export default async function UsersPage() {
  const actor = await requireUser();
  if (!can(actor.role, "users.manage")) redirect("/tasks");

  const admin = createAdminClient();
  const [{ data: profiles }, { data: authList }] = await Promise.all([
    (SHOW_TEST_USERS ? admin.from("profiles").select("*") : admin.from("profiles").select("*").eq("is_test", false)).is("deleted_at", null).order("created_at"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const authById = new Map((authList?.users ?? []).map((user) => [user.id, user]));
  const users: ManagedUser[] = (profiles ?? []).map((profile) => {
    const authUser = authById.get(profile.id);
    const accepted = Boolean(authUser?.email_confirmed_at || authUser?.last_sign_in_at);
    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role,
      slackUserId: profile.slack_user_id,
      status: !profile.is_active ? "deactivated" : accepted ? "active" : "invited",
      lastSignInAt: authUser?.last_sign_in_at ?? null,
    };
  });

  return <UsersTable users={users} actorId={actor.id} actorRole={actor.role} />;
}
