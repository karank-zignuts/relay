"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, CornerDownRight, ExternalLink, MessageSquare, MoreHorizontal, Paperclip, Pencil, Rows3, Trash2 } from "lucide-react";
import { useState } from "react";
import { useSession } from "@/components/session-provider";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { OptionSelect } from "@/components/ui/option-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tip } from "@/components/ui/tip";
import { can } from "@/lib/auth/roles";
import { formatDateTime, formatShortDate } from "@/lib/format";
import { usePersisted, usePersistedList } from "@/lib/use-persisted";
import { cn } from "@/lib/utils";
import type { SortKey, SortState } from "../filters";
import { useDeleteTask } from "../queries";
import { attachmentCount, commentCount, type Task, type TeamMember } from "../types";
import { AreaTags, EnvStrip, TagList } from "./task-chips";
import { AssigneeCell, ModuleCell, PriorityCell, StatusCell } from "./task-cells";
import { COLUMNS, COLUMNS_KEY, DEFAULT_HIDDEN, DENSITY_KEY } from "./table-columns";

export const PAGE_SIZES = [25, 50, 100] as const;

function useColumns() {
  const [hidden, setHidden] = usePersistedList(COLUMNS_KEY, DEFAULT_HIDDEN);
  const [compact, setCompact] = usePersisted<boolean>(DENSITY_KEY, false);
  return { hidden, setHidden, compact, setCompact, visible: COLUMNS.filter((column) => !hidden.includes(column.id)) };
}

/** Same columns, same row height as the real table, so the page does not move when data arrives. */
export function TaskTableSkeleton({ rows = 9 }: { rows?: number }) {
  const { visible, compact } = useColumns();
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" aria-busy="true" aria-label="Loading tasks">
      <div className="flex h-8 shrink-0 items-center justify-end gap-2">
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
      <div className="relative flex min-h-[320px] flex-1 flex-col overflow-hidden rounded-[20px] border border-border bg-background">
        <div className="min-h-0 flex-1 overflow-hidden">
          <Table className={cn(compact && "[&_td]:py-1.5")}>
            <TableHeader className="bg-background shadow-[0_1px_0_var(--border)]">
              <TableRow className="border-0 hover:bg-transparent">
                {visible.map((column) => (
                  <TableHead key={column.id} className={column.className}>
                    {column.label}
                  </TableHead>
                ))}
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: rows }).map((_, row) => (
                <TableRow key={row} className="hover:bg-transparent">
                  {visible.map((column) => (
                    <TableCell key={column.id} className="align-middle">
                      {column.id === "title" ? (
                        <div className="space-y-1.5">
                          <Skeleton className={cn("h-3.5", row % 3 === 0 ? "w-4/5" : row % 3 === 1 ? "w-2/3" : "w-11/12")} />
                          <Skeleton className="h-3 w-14 rounded-full" />
                        </div>
                      ) : column.id === "assignees" ? (
                        <Skeleton className="size-6 rounded-full" />
                      ) : (
                        <Skeleton className={cn("h-3.5", column.skeleton)} />
                      )}
                    </TableCell>
                  ))}
                  <TableCell />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

type TaskTableProps = {
  tasks: Task[];
  total: number;
  team: Map<string, TeamMember>;
  members: TeamMember[];
  sort: SortState;
  onSort: (key: SortKey) => void;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  onOpen: (task: Task) => void;
  activeId: string | null;
  fetching?: boolean;
};

export function TaskTable({ tasks, total, team, members, sort, onSort, page, pageSize, onPage, onPageSize, onOpen, activeId, fetching = false }: TaskTableProps) {
  const user = useSession();
  const { hidden, setHidden, compact, setCompact, visible } = useColumns();
  const [deleting, setDeleting] = useState<Task | null>(null);
  const deleteTask = useDeleteTask();

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const canDelete = can(user.role, "tasks.delete");
  const toggleColumn = (id: string) => setHidden(hidden.includes(id) ? hidden.filter((item) => item !== id) : [...hidden, id]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-end gap-2">
        <Tip label={compact ? "Switch to roomier rows" : "Fit more rows on screen"}>
          <Button variant="ghost" size="sm" aria-pressed={compact} onClick={() => setCompact(!compact)}>
            <Rows3 /> {compact ? "Compact" : "Comfortable"}
          </Button>
        </Tip>
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
        <div aria-hidden className={cn("absolute inset-x-0 top-0 z-20 h-0.5 animate-shimmer bg-[linear-gradient(90deg,transparent,var(--foreground),transparent)] bg-[length:200%_100%] transition-opacity duration-150", fetching ? "opacity-100" : "opacity-0")} />
        <div className={cn("min-h-0 flex-1 overflow-auto transition-opacity duration-150", fetching && "opacity-70")} data-testid="task-scroll">
          <Table data-testid="task-table" className={cn(compact && "[&_td]:py-1.5")}>
            <TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_var(--border)]">
              <TableRow className="border-0 hover:bg-transparent">
                {visible.map((column) => {
                  const sorted = column.sort && sort?.key === column.sort ? sort.direction : null;
                  return (
                    <TableHead key={column.id} className={column.className} aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}>
                      {column.sort ? (
                        <Tip label={sorted === "asc" ? "Sorted ascending. Click for descending" : sorted === "desc" ? "Sorted descending. Click to clear" : `Sort by ${column.label.toLowerCase()}`} side="bottom">
                          <button
                            type="button"
                            className={cn("group/sort -mx-1.5 flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors duration-75 hover:bg-secondary hover:text-foreground", sorted && "bg-secondary text-foreground")}
                            onClick={() => onSort(column.sort!)}
                          >
                            {column.label}
                            <span className="grid size-3 place-items-center">
                              {sorted === "asc" ? (
                                <ArrowUp className="size-3" />
                              ) : sorted === "desc" ? (
                                <ArrowDown className="size-3" />
                              ) : (
                                <ArrowUpDown className="size-3 opacity-0 transition-opacity duration-75 group-hover/sort:opacity-60" />
                              )}
                            </span>
                          </button>
                        </Tip>
                      ) : (
                        column.label
                      )}
                    </TableHead>
                  );
                })}
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
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
                  className={cn("group cursor-pointer outline-none transition-colors duration-75 focus-visible:bg-secondary focus-visible:shadow-[inset_2px_0_0_var(--foreground)]", activeId === task.id && "bg-secondary", task.id.startsWith("pending-") && "opacity-60")}
                >
                  {visible.map((column) => (
                    <TableCell key={column.id} className={cn("align-middle", column.id === "title" && "whitespace-normal")}>
                      {renderCell(column.id, task, team, members)}
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

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="tabular-nums" data-testid="table-range">
          {total === 0 ? "" : `Showing ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)} of ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline">Rows</span>
          <OptionSelect variant="pill" aria-label="Rows per page" value={String(pageSize)} onValueChange={(value) => onPageSize(Number(value))} options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))} className="h-7 px-3" />
          {pages > 1 ? (
            <>
              <span className="tabular-nums">
                Page {page + 1} of {pages}
              </span>
              <Tip label="Previous page">
                <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={page === 0} onClick={() => onPage(page - 1)}>
                  <ChevronLeft />
                </Button>
              </Tip>
              <Tip label="Next page">
                <Button variant="outline" size="icon-sm" aria-label="Next page" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
                  <ChevronRight />
                </Button>
              </Tip>
            </>
          ) : null}
        </div>
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

function renderCell(id: string, task: Task, team: Map<string, TeamMember>, members: TeamMember[]) {
  switch (id) {
    case "number":
      return <span className="font-mono text-xs text-muted-foreground tabular-nums">{task.task_number > 0 ? `#${task.task_number}` : "…"}</span>;
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
          <p className="flex items-center gap-1.5 font-medium leading-snug" data-testid="task-title">
            {task.title}
            {attachmentCount(task) > 0 ? (
              <Tip label={`${attachmentCount(task)} attachment${attachmentCount(task) === 1 ? "" : "s"}`}>
                <Paperclip className="size-3 shrink-0 text-muted-foreground" aria-label="Has attachments" />
              </Tip>
            ) : null}
          </p>
          {task.tags.length ? (
            <div className="mt-1">
              <TagList tags={task.tags} />
            </div>
          ) : null}
        </div>
      );
    case "description":
      return <p className="line-clamp-2 max-w-md whitespace-normal text-muted-foreground">{task.description || "—"}</p>;
    case "date":
      return (
        <Tip label={formatDateTime(task.task_date)}>
          <time dateTime={task.task_date} className="text-graphite">
            {formatShortDate(task.task_date)}
          </time>
        </Tip>
      );
    case "module":
      return <ModuleCell task={task} />;
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
      return <AssigneeCell task={task} team={team} members={members} showName />;
    case "status":
      return <StatusCell task={task} />;
    case "comments":
      return commentCount(task) > 0 ? (
        <span className="inline-flex items-center gap-1 text-graphite tabular-nums">
          <MessageSquare className="size-3.5" aria-hidden /> {commentCount(task)}
        </span>
      ) : (
        dash
      );
    case "priority":
      return <PriorityCell task={task} />;
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

