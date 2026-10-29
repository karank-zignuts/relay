import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];

export type TaskStatus = Enums["task_status"];
export type TaskPriority = Enums["task_priority"];
export type TaskEnv = Enums["task_env"];
export type TaskChangeArea = Enums["task_change_area"];

export const STATUSES: readonly TaskStatus[] = ["backlog", "to_do", "in_progress", "in_review", "blocked", "done"];
export const PRIORITIES: readonly TaskPriority[] = ["urgent", "high", "medium", "low"];
export const ENVIRONMENTS: readonly TaskEnv[] = ["local", "development", "staging", "production"];
export const CHANGE_AREAS: readonly TaskChangeArea[] = ["fe", "be", "db", "devops", "design", "other"];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  to_do: "To do",
  in_progress: "In progress",
  in_review: "In review",
  blocked: "Blocked",
  done: "Done",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const ENV_LABELS: Record<TaskEnv, string> = {
  local: "Local",
  development: "Development",
  staging: "Staging",
  production: "Production",
};

export const AREA_LABELS: Record<TaskChangeArea, string> = {
  fe: "FE",
  be: "BE",
  db: "DB",
  devops: "DevOps",
  design: "Design",
  other: "Other",
};
