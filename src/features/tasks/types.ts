import type { Database } from "@/types/database";

type Tables = Database["public"]["Tables"];

export type TaskRecord = Tables["tasks"]["Row"];
export type TaskUpdate = Tables["tasks"]["Update"];
export type CommentRecord = Tables["task_comments"]["Row"];

export type Task = TaskRecord & {
  task_assignees: { user_id: string }[];
  parent: { id: string; task_number: number; title: string } | null;
  task_comments: { count: number }[];
};

export type TeamMember = Pick<Tables["profiles"]["Row"], "id" | "full_name" | "email" | "role" | "is_active" | "slack_user_id">;

export type Comment = CommentRecord & { author: Pick<TeamMember, "id" | "full_name" | "email"> | null };

export const commentCount = (task: Task) => task.task_comments[0]?.count ?? 0;
export const assigneeIds = (task: Task) => task.task_assignees.map((assignee) => assignee.user_id);
