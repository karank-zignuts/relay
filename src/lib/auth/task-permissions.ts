import { can, type UserRole } from "@/lib/auth/roles";

export type TaskEditScope = "all" | "status_only" | "none";

/** What the signed-in user may edit on a task. Mirrors the tasks RLS policy and field-guard trigger. */
export function taskEditScope(role: UserRole, userId: string, assigneeIds: readonly string[]): TaskEditScope {
  if (role === "super_admin" || role === "project_manager") return "all";
  if (role === "developer") return assigneeIds.includes(userId) && can(role, "tasks.edit") ? "all" : "status_only";
  return can(role, "tasks.edit_status") ? "status_only" : "none";
}
