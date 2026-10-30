import { createClient } from "@/lib/supabase/client";
import type { toRpcArgs } from "./filters";
import type { Attachment, Comment, CommentRead, Task, TaskLite, TaskPage, TaskUpdate, TeamMember } from "./types";
import type { TaskChangeArea, TaskEnv, TaskPriority, TaskStatus } from "./constants";

const TASK_SELECT = "*, task_assignees(user_id), parent:parent_task_id(id, task_number, title), task_comments(count), task_attachments(count)";

type ListArgs = ReturnType<typeof toRpcArgs>;

/** One filtered, sorted page. The database does the work, so the browser never holds the whole list. */
export async function listTasksPage(args: ListArgs): Promise<TaskPage> {
  const { data, error } = await createClient().rpc("list_tasks", args);
  if (error) throw new Error(error.message);
  return data as unknown as TaskPage;
}

/** Header numbers that do not depend on the filters or the view. */
export async function getTaskCounts(): Promise<{ open: number; all: number }> {
  const supabase = createClient();
  const [open, all] = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "done"),
    supabase.from("tasks").select("id", { count: "exact", head: true }),
  ]);
  if (open.error) throw new Error(open.error.message);
  if (all.error) throw new Error(all.error.message);
  return { open: open.count ?? 0, all: all.count ?? 0 };
}

export async function getTask(id: string): Promise<Task | null> {
  const { data, error } = await createClient().from("tasks").select(TASK_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as Task | null;
}

/** Number and title only, for the parent-task picker. */
export async function listTaskLite(): Promise<TaskLite[]> {
  const { data, error } = await createClient().from("tasks").select("id, task_number, title, parent_task_id").order("task_number").limit(1000);
  if (error) throw new Error(error.message);
  return data;
}

/** Threads where the client may be waiting: the server narrows them, the attention rules finish the job. */
export async function listAttentionCandidates(): Promise<Task[]> {
  const { data, error } = await createClient()
    .from("tasks")
    .select(TASK_SELECT)
    .or("and(status.neq.done,last_client_message_at.not.is.null),reply_dismissed_at.not.is.null")
    .order("last_client_message_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return data as unknown as Task[];
}

export async function listModules(): Promise<string[]> {
  const { data, error } = await createClient().from("modules").select("name").order("name");
  if (error) throw new Error(error.message);
  return data.map((row) => row.name);
}

export async function listTags(): Promise<string[]> {
  const { data, error } = await createClient().from("tasks").select("tags").limit(1000);
  if (error) throw new Error(error.message);
  return [...new Set(data.flatMap((row) => row.tags))].sort();
}

/** Test accounts are left out unless the viewer is one. The database enforces the same rule, this keeps it true before that is in place. */
export async function listTeam(viewerIsTest = false): Promise<TeamMember[]> {
  let query = createClient().from("profiles").select("id, full_name, email, role, is_active, slack_user_id").order("full_name");
  if (!viewerIsTest) query = query.eq("is_test", false);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export type NewTask = {
  title: string;
  description: string;
  module: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  environments?: TaskEnv[];
  changes_in?: TaskChangeArea[];
  parent_task_id?: string | null;
};

export async function createTask(input: NewTask, userId: string): Promise<void> {
  const { error } = await createClient().from("tasks").insert({ ...input, created_by: userId });
  if (error) throw new Error(error.message);
}

export async function updateTask(id: string, patch: TaskUpdate): Promise<void> {
  const { data, error } = await createClient().from("tasks").update(patch).eq("id", id).select("id");
  if (error) throw new Error(error.message);
  // RLS hides rows the user may not edit, which surfaces as zero rows updated.
  if (data.length === 0) throw new Error("You do not have permission to edit this task.");
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await createClient().rpc("delete_task", { p_task_id: id });
  if (error) throw new Error(error.message);
}

export async function setAssignees(taskId: string, current: string[], next: string[]): Promise<void> {
  const supabase = createClient();
  const toAdd = next.filter((id) => !current.includes(id));
  const toRemove = current.filter((id) => !next.includes(id));
  if (toAdd.length) {
    const { error } = await supabase.from("task_assignees").insert(toAdd.map((user_id) => ({ task_id: taskId, user_id })));
    if (error) throw new Error(error.message);
  }
  if (toRemove.length) {
    const { error } = await supabase.from("task_assignees").delete().eq("task_id", taskId).in("user_id", toRemove);
    if (error) throw new Error(error.message);
  }
}

export async function setReplyDismissed(taskId: string, dismissed: boolean): Promise<void> {
  const { error } = await createClient().rpc("dismiss_reply", { p_task_id: taskId, p_dismissed: dismissed });
  if (error) throw new Error(error.message);
}

/** Moves a card: new column and a place in it. */
export async function moveTask(id: string, status: TaskStatus, boardRank: number): Promise<void> {
  const { data, error } = await createClient().from("tasks").update({ status, board_rank: boardRank }).eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (data.length === 0) throw new Error("You do not have permission to move this task.");
}

export async function listComments(taskId: string): Promise<Comment[]> {
  const { data, error } = await createClient()
    .from("task_comments")
    .select("*, author:profiles!author_id(id, full_name, email)")
    .eq("task_id", taskId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return data as unknown as Comment[];
}

export async function addComment(taskId: string, authorId: string, body: string): Promise<void> {
  const { error } = await createClient().from("task_comments").insert({ task_id: taskId, author_id: authorId, body: body.trim() });
  if (error) throw new Error(error.message);
}

export async function editComment(commentId: string, body: string): Promise<void> {
  const { error } = await createClient().rpc("edit_comment", { p_comment_id: commentId, p_body: body });
  if (error) throw new Error(error.message);
}

export async function listCommentReads(taskId: string): Promise<CommentRead[]> {
  const { data: comments, error: commentsError } = await createClient().from("task_comments").select("id").eq("task_id", taskId);
  if (commentsError) throw new Error(commentsError.message);
  if (comments.length === 0) return [];
  const { data, error } = await createClient().from("comment_reads").select("comment_id, user_id, read_at").in("comment_id", comments.map((comment) => comment.id));
  if (error) throw new Error(error.message);
  return data;
}

export async function markCommentsRead(taskId: string): Promise<void> {
  const { error } = await createClient().rpc("mark_comments_read", { p_task_id: taskId });
  if (error) throw new Error(error.message);
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await createClient().rpc("delete_comment", { p_comment_id: commentId });
  if (error) throw new Error(error.message);
}

const BUCKET = "task-attachments";
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export async function listAttachments(taskId: string): Promise<Attachment[]> {
  const { data, error } = await createClient()
    .from("task_attachments")
    .select("*, uploader:profiles!uploaded_by(id, full_name, email)")
    .eq("task_id", taskId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return data as unknown as Attachment[];
}

export async function uploadAttachment(taskId: string, file: File, userId: string): Promise<void> {
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error(`${file.name} is larger than 25 MB.`);
  const supabase = createClient();
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${taskId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (uploadError) throw new Error(uploadError.message);
  const { error } = await supabase.from("task_attachments").insert({
    task_id: taskId,
    source: "team",
    file_name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    storage_path: path,
    uploaded_by: userId,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(error.message);
  }
}

export async function deleteAttachment(id: string): Promise<void> {
  const { error } = await createClient().rpc("delete_attachment", { p_attachment_id: id });
  if (error) throw new Error(error.message);
}

/** A short-lived link to a private file. Files kept elsewhere (client links) are returned as they are. */
export async function attachmentUrl(attachment: Attachment): Promise<string | null> {
  if (attachment.storage_path) {
    const { data, error } = await createClient().storage.from(BUCKET).createSignedUrl(attachment.storage_path, 3600);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  }
  return attachment.external_url;
}
