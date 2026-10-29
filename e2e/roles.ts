import path from "node:path";
import { test } from "@playwright/test";

// One test account per role. Emails and the shared password live in .env.e2e (see .env.e2e.example).
export const ROLES = {
  super_admin: "E2E_SUPER_ADMIN_EMAIL",
  project_manager: "E2E_PROJECT_MANAGER_EMAIL",
  developer: "E2E_DEVELOPER_EMAIL",
  tester: "E2E_TESTER_EMAIL",
} as const;

export type Role = keyof typeof ROLES;

export const authFile = (role: Role) => path.join(__dirname, ".auth", `${role}.json`);

/** Put at the top of a spec to run every test in it as one role. */
export function asRole(role: Role) {
  test.use({ storageState: authFile(role) });
}
