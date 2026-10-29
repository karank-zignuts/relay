// Creates (or resets) one confirmed test account per role and writes .env.e2e.
// Run: npm run e2e:users   (needs .env.local with the service-role key)
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const roles = ["super_admin", "project_manager", "developer", "tester"];
let password = `Rl-${randomBytes(9).toString("base64url")}9`;
if (existsSync(".env.e2e")) {
  const existing = readFileSync(".env.e2e", "utf8").match(/^E2E_PASSWORD=(.+)$/m);
  if (existing) password = existing[1].trim();
}

const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
const lines = [`E2E_PASSWORD=${password}`];

for (const role of roles) {
  const email = `relay-e2e+${role}@example.com`;
  const fullName = `E2E ${role.replace("_", " ")}`;
  let user = list.users.find((candidate) => candidate.email === email);
  if (user) {
    await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true, ban_duration: "none" });
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });
    if (error) throw error;
    user = data.user;
  }
  const { error } = await admin.from("profiles").update({ role, full_name: fullName, is_active: true, deleted_at: null }).eq("id", user.id);
  if (error) throw error;
  lines.push(`E2E_${role.toUpperCase()}_EMAIL=${email}`);
}

writeFileSync(".env.e2e", lines.join("\n") + "\n");
console.log(`Wrote .env.e2e with ${roles.length} test accounts.`);
