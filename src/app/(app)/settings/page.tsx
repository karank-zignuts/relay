import { redirect } from "next/navigation";
import { can } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiKeysPanel } from "./api-keys-panel";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const user = await requireUser();
  if (!can(user.role, "settings.manage")) redirect("/tasks");

  const admin = createAdminClient();
  let keysQuery = admin.from("api_keys").select("id, name, key_prefix, last_used_at, revoked_at, created_at").is("deleted_at", null).order("created_at", { ascending: false });
  // Keys made by the automated tests are never shown to people. Only the test accounts themselves see them.
  if (!user.isTest) keysQuery = keysQuery.not("name", "like", "e2e-%");
  const [{ data: settings }, { data: keys }] = await Promise.all([
    admin.from("app_settings").select("*").eq("id", true).single(),
    keysQuery,
  ]);
  if (!settings) throw new Error("Settings row is missing");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 px-4 py-8 sm:px-8">
      <h1 className="text-[32px] leading-[1.13] font-light tracking-[-0.02em]">Settings</h1>
      <SettingsForm
        initial={{
          forgottenReplyHours: settings.forgotten_reply_hours,
          workingHoursStart: settings.working_hours_start.slice(0, 5),
          workingHoursEnd: settings.working_hours_end.slice(0, 5),
          workingHoursTimezone: settings.working_hours_timezone,
        }}
      />
      <ApiKeysPanel keys={keys ?? []} />
    </div>
  );
}
