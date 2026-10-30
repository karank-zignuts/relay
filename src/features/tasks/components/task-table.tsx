"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3, CornerDownRight, ExternalLink, MessageSquare, MoreHorizontal, Pencil, Rows3, Trash2 } from "lucide-react";
import { useState } from "react";
import { useSession } from "@/components/session-provider";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/lib/auth/roles";
import { formatDateTime, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SortDirection, SortKey } from "../filters";
import { useDeleteTask } from "../queries";
import { assigneeIds, commentCount, type Task, type TeamMember } from "../types";
import { AreaTags, AssigneeStack, EnvStrip, PriorityChip, StatusChip, TagList } from "./task-chips";

const PAGE_SIZE = 50;
const COLUMNS_KEY = "relay.task-columns";
const DENSITY_KEY = "relay.task-density";

type Column = { id: string; label: string; sort?: SortKey; className?: string };

const COLUMNS: Column[] = [
  { id: "number", label: "#", sort: "task_number", className: "w-16" },
  { id: "title", label: "Title", sort: "title", className: "min-w-[320px]" },
  { id: "description", label: "Description", className: "min-w-64" },
  { id: "status", label: "Status", sort: "status" },
  { id: "priority", label: "Priority", sort: "priority" },
  { id: "assignees", label: "Assignees" },
  { id: "module", label: "Module", sort: "module" },
  { id: "date", label: "Date", sort: "task_date", className: "whitespace-nowrap" },
  { id: "slack", label: "Slack" },
  { id: "comments", label: "Comments" },
  { id: "jira", label: "Jira" },
  { id: "env", label: "Environments" },
  { id: "area", label: "Changes in" },
  { id: "parent", label: "Parent" },
];

const DEFAULT_HIDDEN = ["description", "area", "parent", "comments"];

function usePersisted<T>(key: string, fallback: T) {
  // Safe to read synchronously: this table only renders on the client, after the task query resolves.
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? (JSON.parse(saved) as T) : fallback;
    } catch {
      return fallback; // Storage can be unavailable (private window). The default still works.
    }
  });
  const update = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // The preference just will not persist.
    }
  };
  return [value, update] as const;
}

export function TaskTable({
  tasks,
  team,
  sort,
  onSort,
  onOpen,
  activeId,
  fetching = false,
}: {
  tasks: Task[];
  team: Map<string, TeamMember>;
  sort: { key: SortKey; direction: SortDirection };
  onSort: (key: SortKey) => void;
  onOpen: (task: Task) => void;
  activeId: string | null;
  fetching?: boolean;
}) {
  const user = useSession();
  const [hidden, setHidden] = usePersisted<string[]>(COLUMNS_KEY, DEFAULT_HIDDEN);
  const [density, setDensity] = usePersisted<"comfortable" | "compact">(DENSITY_KEY, "comfortable");
  const [page, setPage] = useState(0);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const deleteTask = useDeleteTask();

  const pages = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const rows = tasks.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const visible = COLUMNS.filter((column) => !hidden.includes(column.id));
  const canDelete = can(user.role, "tasks.delete");
  const toggleColumn = (id: string) => setHidden(hidden.includes(id) ? hidden.filter((item) => item !== id) : [...hidden, id]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-end gap-2">
        <Button variant="ghost" size="sm" aria-pressed={density === "compact"} onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}>
          <Rows3 /> {density === "compact" ? "Compact" : "Comfortable"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <Columns3 /> Columns
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            {COLUMNS.filter((column) => column.id !== "title").map((column) => (
              <DropdownMenuCheckboxItem key={column.id} checked={!hidden.includes(column.id)} onCheckedChange={() => toggleColumn(column.id)}>
                {column.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="relative flex min-h-[320px] flex-1 flex-col overflow-hidden rounded-[20px] border border-border bg-background">
        <div aria-hidden className={cn("absolute inset-x-0 top-0 z-20 h-0.5 animate-shimmer bg-[linear-gradient(90deg,transparent,var(--ring),transparent)] bg-[length:200%_100%] transition-opacity duration-100", fetching ? "opacity-100" : "opacity-0")} />
        <div className="min-h-0 flex-1 overflow-auto" data-testid="task-scroll">
          <Table data-testid="task-table" className={cn(density === "compact" && "[&_td]:py-1.5")}>
            <TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_var(--border)]">
              <TableRow className="border-0 hover:bg-transparent">
                {visible.map((column) => (
                  <TableHead key={column.id} className={column.className} aria-sort={column.sort && sort.key === column.sort ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}>
                    {column.sort ? (
                      <button type="button" className="-mx-1.5 flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors hover:bg-secondary hover:text-foreground" onClick={() => onSort(column.sort!)}>
                        {column.label}
                        <span className="grid size-3 place-items-center">
                          {sort.key === column.sort ? sort.direction === "asc" ? <ArrowUp className="size-3 text-foreground" /> : <ArrowDown className="size-3 text-foreground" /> : null}
                        </span>
                      </button>
                    ) : (
                      column.label
                    )}
                  </TableHead>
                ))}
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((task) => (
                <TableRow
                  key={task.id}
                  data-testid="task-row"
                  tabIndex={0}
                  onClick={() => onOpen(task)}
                  onKeyDown={(event) => {
                    if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      onOpen(task);
                    }
                  }}
                  className={cn("group cursor-pointer outline-none focus-visible:bg-secondary focus-visible:shadow-[inset_2px_0_0_var(--ring)]", activeId === task.id && "bg-secondary")}
                >
                  {visible.map((column) => (
                    <TableCell key={column.id} className={cn("align-middle", column.id === "title" && "whitespace-normal")}>
                      {renderCell(column.id, task, team)}
                    </TableCell>
                  ))}
                  <TableCell className="align-middle" onClick={(event) => event.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-popup-open:opacity-100" aria-label={`Actions for task ${task.task_number}`} />}>
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-40">
                        <DropdownMenuItem onClick={() => onOpen(task)}>
                          <Pencil /> Open / edit
                        </DropdownMenuItem>
                        {canDelete ? (
                          <DropdownMenuItem onClick={() => setDeleting(task)}>
                            <Trash2 /> Delete
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between text-sm text-muted-foreground">
        <span className="tabular-nums">
          {tasks.length === 0 ? "" : `Showing ${current * PAGE_SIZE + 1}–${Math.min((current + 1) * PAGE_SIZE, tasks.length)} of ${tasks.length}`}
        </span>
        {pages > 1 ? (
          <div className="flex items-center gap-2">
            <span className="tabular-nums">
              Page {current + 1} of {pages}
            </span>
            <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon-sm" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              <ChevronRight />
            </Button>
          </div>
        ) : null}
      </div>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task #{deleting?.task_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.title}” and its sub-tasks will be removed from every view. The change is recorded in the activity log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) deleteTask.mutate(deleting.id);
                setDeleting(null);
              }}
            >
              Delete task
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const dash = <span className="text-muted-foreground">—</span>;

function renderCell(id: string, task: Task, team: Map<string, TeamMember>) {
  switch (id) {
    case "number":
      return <span className="font-mono text-xs text-muted-foreground tabular-nums">#{task.task_number}</span>;
    case "title":
      return (
        <div className="min-w-0">
          {task.parent ? (
            <p className="mb-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <CornerDownRight className="size-3" aria-hidden />
              <span className="truncate">
                #{task.parent.task_number} {task.parent.title}
              </span>
            </p>
          ) : null}
          <p className="font-medium leading-snug">{task.title}</p>
          {task.tags.length ? <div className="mt-1"><TagList tags={task.tags} /></div> : null}
        </div>
      );
    case "description":
      return <p className="line-clamp-2 max-w-md whitespace-normal text-muted-foreground">{task.description || "—"}</p>;
    case "date":
      return (
        <time dateTime={task.task_date} title={formatDateTime(task.task_date)} className="text-graphite">
          {formatShortDate(task.task_date)}
        </time>
      );
    case "module":
      return task.module ? <span className="text-graphite">{task.module}</span> : dash;
    case "slack":
      return task.slack_url ? (
        <a href={task.slack_url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1 text-graphite underline-offset-4 transition-colors hover:text-foreground hover:underline">
          Slack <ExternalLink className="size-3" aria-hidden />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ) : (
        dash
      );
    case "assignees":
      return <AssigneeStack ids={assigneeIds(task)} team={team} showName />;
    case "status":
      return <StatusChip status={task.status} />;
    case "comments":
      return commentCount(task) > 0 ? (
        <span className="inline-flex items-center gap-1 text-graphite tabular-nums">
          <MessageSquare className="size-3.5" aria-hidden /> {commentCount(task)}
        </span>
      ) : (
        dash
      );
    case "priority":
      return <PriorityChip priority={task.priority} />;
    case "jira":
      return task.jira_key ? (
        <span className="flex flex-col gap-0.5">
          {task.jira_url ? (
            <a href={task.jira_url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="font-mono text-xs underline-offset-4 hover:underline">
              {task.jira_key}
            </a>
          ) : (
            <span className="font-mono text-xs">{task.jira_key}</span>
          )}
          {task.jira_status ? <span className="text-xs text-muted-foreground">{task.jira_status}</span> : null}
        </span>
      ) : (
        dash
      );
    case "env":
      return <EnvStrip values={task.environments} />;
    case "area":
      return <AreaTags values={task.changes_in} />;
    case "parent":
      return task.parent ? <span className="text-xs">#{task.parent.task_number} {task.parent.title}</span> : dash;
    default:
      return null;
  }
}
