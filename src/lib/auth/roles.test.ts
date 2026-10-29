import { describe, expect, it } from "vitest";
import { assignableRoles, can, canManageRole, USER_ROLES } from "./roles";

describe("can", () => {
  it("lets only Super Admin and PM manage users", () => {
    expect(USER_ROLES.filter((role) => can(role, "users.manage"))).toEqual([
      "super_admin",
      "project_manager",
    ]);
  });

  it("lets only Super Admin manage API keys and settings", () => {
    for (const permission of ["api_keys.manage", "settings.manage"] as const) {
      expect(USER_ROLES.filter((role) => can(role, permission))).toEqual(["super_admin"]);
    }
  });

  it("lets testers change status but not edit other task fields", () => {
    expect(can("tester", "tasks.edit_status")).toBe(true);
    expect(can("tester", "tasks.edit")).toBe(false);
    expect(can("tester", "tasks.create")).toBe(false);
    expect(can("tester", "tasks.delete")).toBe(false);
  });

  it("lets developers edit but not create or delete tasks", () => {
    expect(can("developer", "tasks.edit")).toBe(true);
    expect(can("developer", "tasks.create")).toBe(false);
    expect(can("developer", "tasks.delete")).toBe(false);
  });

  it("lets everyone comment", () => {
    for (const role of USER_ROLES) expect(can(role, "comments.create")).toBe(true);
  });

  it("limits the activity log to Super Admin and PM", () => {
    expect(USER_ROLES.filter((role) => can(role, "activity.view"))).toEqual([
      "super_admin",
      "project_manager",
    ]);
  });
});

describe("canManageRole", () => {
  it("lets Super Admin manage every role", () => {
    for (const role of USER_ROLES) expect(canManageRole("super_admin", role)).toBe(true);
  });

  it("stops a PM from touching Super Admins", () => {
    expect(canManageRole("project_manager", "super_admin")).toBe(false);
    expect(canManageRole("project_manager", "project_manager")).toBe(true);
    expect(canManageRole("project_manager", "developer")).toBe(true);
  });

  it("stops developers and testers from managing anyone", () => {
    for (const actor of ["developer", "tester"] as const) {
      for (const role of USER_ROLES) expect(canManageRole(actor, role)).toBe(false);
    }
  });
});

describe("assignableRoles", () => {
  it("excludes Super Admin for a PM", () => {
    expect(assignableRoles("project_manager")).toEqual([
      "project_manager",
      "developer",
      "tester",
    ]);
  });

  it("returns nothing for roles that cannot manage users", () => {
    expect(assignableRoles("developer")).toEqual([]);
  });
});
