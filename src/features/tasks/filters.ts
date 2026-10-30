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

export type SortKey = "task_number" | "title" | "task_date" | "module" | "status" | "priority";
export type SortDirection = "asc" | "desc";
/** `null` is the normal order: newest first in the table, manual order on the board. */
export type SortState = { key: SortKey; direction: SortDirection } | null;

/**
 * Header click cycles ascending, then descending, then back to the normal order.
 */
export function nextSort(current: SortState, key: SortKey): SortState {
  if (!current || current.key !== key) return { key, direction: "asc" };
  if (current.direction === "asc") return { key, direction: "desc" };
  return null;
}

/** Arguments of the `list_tasks` database function. Filtering, sorting and paging all happen on the server. */
export function toRpcArgs(
  filters: TaskFilters,
  sort: SortState,
  paging: { limit: number; offset: number },
  options: { manualOrder?: boolean; status?: TaskStatus[] } = {},
) {
  const from = filters.from ? new Date(`${filters.from}T00:00:00`).toISOString() : null;
  const to = filters.to ? new Date(`${filters.to}T23:59:59.999`).toISOString() : null;
  const sortKey = sort ? sort.key : options.manualOrder ? "board_rank" : "task_date";
  return {
    p_search: filters.search.trim(),
    p_status: options.status ?? filters.status,
    p_priority: filters.priority,
    p_assignees: filters.assignee,
    p_modules: filters.module,
    p_envs: filters.env,
    p_areas: filters.area,
    p_tags: filters.tag,
    p_jira: filters.jira,
    p_level: filters.level,
    p_from: from ?? undefined,
    p_to: to ?? undefined,
    p_hide_done: options.manualOrder ? false : filters.hideDone,
    p_sort: sortKey,
    p_dir: sort ? sort.direction : options.manualOrder ? "asc" : "desc",
    p_limit: paging.limit,
    p_offset: paging.offset,
  };
}
