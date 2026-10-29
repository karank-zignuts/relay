import { assigneeIds, type Task } from "./types";
import type { TaskChangeArea, TaskEnv, TaskPriority, TaskStatus } from "./constants";

export const UNASSIGNED = "unassigned";

export type TaskFilters = {
  search: string;
  status: TaskStatus[];
  priority: TaskPriority[];
  assignee: string[]; // user ids, or UNASSIGNED
  module: string[];
  env: TaskEnv[];
  area: TaskChangeArea[];
  tag: string[];
  jira: "any" | "yes" | "no";
  level: "all" | "parents" | "subtasks";
  from: string; // yyyy-mm-dd
  to: string;
  hideDone: boolean;
};

export const EMPTY_FILTERS: TaskFilters = {
  search: "",
  status: [],
  priority: [],
  assignee: [],
  module: [],
  env: [],
  area: [],
  tag: [],
  jira: "any",
  level: "all",
  from: "",
  to: "",
  hideDone: false,
};

export function activeFilterCount(filters: TaskFilters): number {
  const { search, jira, level, from, to, hideDone, ...lists } = filters;
  return (
    Object.values(lists).filter((value) => value.length > 0).length +
    [search.trim() !== "", jira !== "any", level !== "all", from !== "", to !== "", hideDone].filter(Boolean).length
  );
}

const intersects = <T,>(selected: readonly T[], values: readonly T[]) => selected.some((item) => values.includes(item));

export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  const search = filters.search.trim().toLowerCase();
  const from = filters.from ? Date.parse(`${filters.from}T00:00:00`) : null;
  const to = filters.to ? Date.parse(`${filters.to}T23:59:59.999`) : null;

  return tasks.filter((task) => {
    if (search) {
      const haystack = [`#${task.task_number}`, task.title, task.description, task.module ?? "", task.jira_key ?? "", ...task.tags]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (filters.hideDone && task.status === "done") return false;
    if (filters.status.length && !filters.status.includes(task.status)) return false;
    if (filters.priority.length && !filters.priority.includes(task.priority)) return false;
    if (filters.module.length && !(task.module && filters.module.includes(task.module))) return false;
    if (filters.env.length && !intersects(filters.env, task.environments)) return false;
    if (filters.area.length && !intersects(filters.area, task.changes_in)) return false;
    if (filters.tag.length && !intersects(filters.tag, task.tags)) return false;
    if (filters.assignee.length) {
      const ids = assigneeIds(task);
      const matchesUnassigned = filters.assignee.includes(UNASSIGNED) && ids.length === 0;
      if (!matchesUnassigned && !intersects(filters.assignee, ids)) return false;
    }
    if (filters.jira === "yes" && !task.jira_key) return false;
    if (filters.jira === "no" && task.jira_key) return false;
    if (filters.level === "parents" && task.parent_task_id) return false;
    if (filters.level === "subtasks" && !task.parent_task_id) return false;
    const date = Date.parse(task.task_date);
    if (from !== null && date < from) return false;
    if (to !== null && date > to) return false;
    return true;
  });
}

export type SortKey = "task_number" | "title" | "task_date" | "module" | "status" | "priority";
export type SortDirection = "asc" | "desc";

const STATUS_ORDER = ["backlog", "to_do", "in_progress", "in_review", "blocked", "done"];
const PRIORITY_ORDER = ["urgent", "high", "medium", "low"];

export function sortTasks(tasks: Task[], key: SortKey, direction: SortDirection): Task[] {
  const factor = direction === "asc" ? 1 : -1;
  const compare = (a: Task, b: Task): number => {
    switch (key) {
      case "task_number":
        return a.task_number - b.task_number;
      case "task_date":
        return Date.parse(a.task_date) - Date.parse(b.task_date);
      case "status":
        return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      case "priority":
        return PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
      case "module":
        return (a.module ?? "").localeCompare(b.module ?? "");
      case "title":
        return a.title.localeCompare(b.title);
    }
  };
  return [...tasks].sort((a, b) => factor * compare(a, b) || b.task_number - a.task_number);
}
