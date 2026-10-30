import { NextResponse } from "next/server";
import { internalError, validationError } from "@/lib/api-error";
import { verifyApiKey } from "@/lib/api/api-key";
import { attachmentsRequestSchema } from "@/features/sync/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "task-attachments";

/**
 * Claude attaches the files a client shared in Slack to the task of that thread.
 * Safe to repeat: a file with the same name on the same task is skipped.
 */
export async function POST(request: Request) {
  const verified = await verifyApiKey(request);
  if (verified.response) return verified.response;

  const parsed = attachmentsRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);

  const admin = createAdminClient();
  const { data: task, error: taskError } = await admin.from("tasks").select("id").eq("slack_thread_ts", parsed.data.thread_ts).is("deleted_at", null).maybeSingle();
  if (taskError) return internalError("attachments.task", taskError);
  if (!task) return NextResponse.json({ error: { code: "NOT_FOUND", message: "No task for that thread_ts. Sync the thread first." } }, { status: 404 });

  const { data: existing, error: existingError } = await admin.from("task_attachments").select("file_name").eq("task_id", task.id).eq("source", "client").is("deleted_at", null);
  if (existingError) return internalError("attachments.existing", existingError);
  const known = new Set(existing.map((row) => row.file_name));

  let added = 0;
  let skipped = 0;
  const failed: { file_name: string; message: string }[] = [];

  for (const file of parsed.data.files) {
    if (known.has(file.file_name)) {
      skipped += 1;
      continue;
    }
    let storagePath: string | null = null;
    if (file.content_base64) {
      const bytes = Buffer.from(file.content_base64, "base64");
      storagePath = `${task.id}/client-${crypto.randomUUID()}-${file.file_name.replace(/[^\w.-]+/g, "_")}`;
      const { error } = await admin.storage.from(BUCKET).upload(storagePath, bytes, { contentType: file.mime_type });
      if (error) {
        failed.push({ file_name: file.file_name, message: error.message });
        continue;
      }
    }
    const { error } = await admin.from("task_attachments").insert({
      task_id: task.id,
      source: "client",
      file_name: file.file_name,
      mime_type: file.mime_type ?? null,
      size_bytes: file.size_bytes ?? null,
      storage_path: storagePath,
      external_url: file.url ?? null,
      uploaded_by_label: `Claude (${verified.apiKey.name})`,
    });
    if (error) {
      failed.push({ file_name: file.file_name, message: error.message });
      continue;
    }
    known.add(file.file_name);
    added += 1;
  }

  return NextResponse.json({ added, skipped, failed }, { status: failed.length && added === 0 ? 422 : 200 });
}
