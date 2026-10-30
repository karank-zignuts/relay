import type { SortKey } from "../filters";

export type Column = { id: string; label: string; sort?: SortKey; className?: string; skeleton: string };

export const COLUMNS: Column[] = [
  { id: "number", label: "#", sort: "task_number", className: "w-16", skeleton: "w-8" },
  { id: "title", label: "Title", sort: "title", className: "min-w-[320px]", skeleton: "w-3/4" },
  { id: "description", label: "Description", className: "min-w-64", skeleton: "w-5/6" },
  { id: "status", label: "Status", sort: "status", skeleton: "w-20" },
  { id: "priority", label: "Priority", sort: "priority", skeleton: "w-16" },
  { id: "assignees", label: "Assignees", skeleton: "w-14" },
  { id: "module", label: "Module", sort: "module", skeleton: "w-20" },
  { id: "date", label: "Date", sort: "task_date", className: "whitespace-nowrap", skeleton: "w-14" },
  { id: "slack", label: "Slack", skeleton: "w-12" },
  { id: "comments", label: "Comments", skeleton: "w-8" },
  { id: "jira", label: "Jira", skeleton: "w-12" },
  { id: "env", label: "Environments", skeleton: "w-24" },
  { id: "area", label: "Changes in", skeleton: "w-16" },
  { id: "parent", label: "Parent", skeleton: "w-20" },
];

export const DEFAULT_HIDDEN = ["description", "area", "parent", "comments"];
export const COLUMNS_KEY = "relay.task-columns";
export const DENSITY_KEY = "relay.task-density";
