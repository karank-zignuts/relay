import { NextResponse } from "next/server";
import { z } from "zod";
import { internalError, validationError } from "@/lib/api-error";
import { verifyApiKey } from "@/lib/api/api-key";
import { createAdminClient } from "@/lib/supabase/admin";

const querySchema = z.object({
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  thread_ts: z.string().optional(),
});

// Compact view so Claude can see what already exists. Cursor is the task number.
export async function GET(request: Request) {
  const verified = await verifyApiKey(request);
  if (verified.response) return verified.response;

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return validationError(parsed.error);
  const { cursor, limit, thread_ts } = parsed.data;

  let query = createAdminClient()
    .from("tasks")
    .select("id, task_number, title, status, priority, module, slack_thread_ts, last_client_message_at, last_team_reply_at, jira_key, human_edited_fields, updated_at")
    .is("deleted_at", null)
    .gt("task_number", cursor)
    .order("task_number")
    .limit(limit);
  if (thread_ts) query = query.eq("slack_thread_ts", thread_ts);

  const { data, error } = await query;
  if (error) return internalError("api-list-tasks", error);

  const nextCursor = data.length === limit ? data[data.length - 1].task_number : null;
  return NextResponse.json({ items: data, nextCursor });
}
