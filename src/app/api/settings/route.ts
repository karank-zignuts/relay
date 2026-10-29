import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { internalError, validationError } from "@/lib/api-error";
import { authorize } from "@/lib/auth/authorize";
import { createAdminClient } from "@/lib/supabase/admin";
import { settingsSchema } from "@/features/settings/schemas";

export async function PATCH(request: Request) {
  const auth = await authorize("settings.manage");
  if (auth.response) return auth.response;

  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  const value = parsed.data;

  const { error } = await createAdminClient()
    .from("app_settings")
    .update({
      forgotten_reply_hours: value.forgottenReplyHours,
      working_hours_start: value.workingHoursStart,
      working_hours_end: value.workingHoursEnd,
      working_hours_timezone: value.workingHoursTimezone,
    })
    .eq("id", true);
  if (error) return internalError("update-settings", error);

  await logActivity({ actor: auth.actor, action: "settings.updated", entityType: "settings", summary: "Updated reply and working-hours settings" });
  return NextResponse.json({ ok: true });
}
