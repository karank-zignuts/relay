import type { Database } from "@/types/database";

type Tables = Database["public"]["Tables"];

export type TaskRecord = Tables["tasks"]["Row"];
export type TaskUpdate = Tables["tasks"]["Update"];
export type CommentRecord = Tables["task_comments"]["Row"];
export type AttachmentRecord = Tables["task_attachments"]["Row"];

export type Task = TaskRecord & {
  task_assignees: { user_id: string }[];
  parent: { id: string; task_number: number; title: string } | null;
  task_comments: { count: number }[];
  task_attachments?: { count: number }[];
  /** Sub-tasks, present on top-level rows when the list is grouped by thread. */
  children?: Task[];
};

/** One page of the server-side task list, with the counts the header shows. */
export type TaskPage = { total: number; open_count: number; all_count: number; rows: Task[] };

export type TaskLite = Pick<TaskRecord, "id" | "task_number" | "title" | "parent_task_id">;

export type TeamMember = Pick<Tables["profiles"]["Row"], "id" | "full_name" | "email" | "role" | "is_active" | "slack_user_id">;

export type Comment = CommentRecord & { author: Pick<TeamMember, "id" | "full_name" | "email"> | null };
export type CommentRead = { comment_id: string; user_id: string; read_at: string };
export type Attachment = AttachmentRecord & { uploader: Pick<TeamMember, "id" | "full_name" | "email"> | null };

export const commentCount = (task: Task) => task.task_comments[0]?.count ?? 0;
export const attachmentCount = (task: Task) => task.task_attachments?.[0]?.count ?? 0;
export const assigneeIds = (task: Task) => task.task_assignees.map((assignee) => assignee.user_id);
