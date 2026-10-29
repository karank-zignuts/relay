import { createClient } from "@/lib/supabase/client";
import type { Comment, Task, TaskUpdate, TeamMember } from "./types";
import type { TaskChangeArea, TaskEnv, TaskPriority, TaskStatus } from "./constants";

const TASK_SELECT = "*, task_assignees(user_id), parent:parent_task_id(id, task_number, title), task_comments(count)";
const PAGE_SIZE = 1000; // Supabase caps a response at 1000 rows
const MAX_PAGES = 10;

export async function listTasks(): Promise<Task[]> {
  const supabase = createClient();
  const tasks: Task[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await supabase
      .from("tasks")
      .select(TASK_SELECT)
      .order("task_date", { ascending: false })
      .order("task_number", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    tasks.push(...(data as unknown as Task[]));
    if (data.length < PAGE_SIZE) break;
  }
  return tasks;
}

export async function listTeam(): Promise<TeamMember[]> {
  const { data, error } = await createClient()
    .from("profiles")
    .select("id, full_name, email, role, is_active, slack_user_id")
    .order("full_name");
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

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await createClient().rpc("delete_comment", { p_comment_id: commentId });
  if (error) throw new Error(error.message);
}
