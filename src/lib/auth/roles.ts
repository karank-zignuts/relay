export const USER_ROLES = [
  "super_admin",
  "project_manager",
  "developer",
  "tester",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  project_manager: "Project Manager",
  developer: "Developer",
  tester: "Tester",
};

export type Permission =
  | "users.manage"
  | "api_keys.manage"
  | "settings.manage"
  | "tasks.create"
  | "tasks.edit"
  | "tasks.delete"
  | "tasks.edit_status"
  | "comments.create"
  | "activity.view";

// Source of truth: ENGINEERING_STANDARDS.md §5. Mirrored in RLS policies.
const PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  super_admin: new Set<Permission>([
    "users.manage",
    "api_keys.manage",
    "settings.manage",
    "tasks.create",
    "tasks.edit",
    "tasks.delete",
    "tasks.edit_status",
    "comments.create",
    "activity.view",
  ]),
  project_manager: new Set<Permission>([
    "users.manage",
    "tasks.create",
    "tasks.edit",
    "tasks.delete",
    "tasks.edit_status",
    "comments.create",
    "activity.view",
  ]),
  developer: new Set<Permission>(["tasks.edit", "tasks.edit_status", "comments.create"]),
  tester: new Set<Permission>(["tasks.edit_status", "comments.create"]),
};

export function can(role: UserRole, permission: Permission): boolean {
  return PERMISSIONS[role].has(permission);
}

/** Roles the actor may assign, edit or delete. A PM can never touch a Super Admin. */
export function canManageRole(actor: UserRole, target: UserRole): boolean {
  if (!can(actor, "users.manage")) return false;
  if (actor === "super_admin") return true;
  return target !== "super_admin";
}

/** Roles the actor may grant when inviting or editing a user. */
export function assignableRoles(actor: UserRole): UserRole[] {
  return USER_ROLES.filter((role) => canManageRole(actor, role));
}
