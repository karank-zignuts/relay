"use client";

import { ChevronDown, Inbox, LayoutGrid, Plus, SearchX, Table2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/lib/auth/roles";
import { usePersisted } from "@/lib/use-persisted";
import { cn } from "@/lib/utils";
import { EMPTY_FILTERS, filterTasks, sortTasks, type SortDirection, type SortKey, type TaskFilters } from "../filters";
import { useTasks, useTasksRealtime, useTeam } from "../queries";
import { CreateTaskDialog } from "./create-task-dialog";
import { KanbanBoard } from "./kanban-board";
import { TaskDrawer } from "./task-drawer";
import { TaskFiltersBar } from "./task-filters-bar";
import { TaskTable } from "./task-table";

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export function TasksWorkspace({ view }: { view: "table" | "board" }) {
  const user = useSession();
  useTasksRealtime();
  const tasksQuery = useTasks();
  const teamQuery = useTeam();
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: "task_date", direction: "desc" });
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // The header is compact by default so the work area gets the screen. The arrow next to the title opens the filters.
  const [expanded, setExpanded] = usePersisted<boolean>("relay.filters-open", false);
  const canCreate = can(user.role, "tasks.create");

  // "/" jumps to search, "n" starts a new task. Both are ignored while typing.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (event.key === "/") {
        event.preventDefault();
        document.getElementById("task-search")?.focus();
      } else if (event.key === "n" && canCreate) {
        event.preventDefault();
        setCreating(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [canCreate]);

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const team = useMemo(() => teamQuery.data ?? [], [teamQuery.data]);
  const teamById = useMemo(() => new Map(team.map((member) => [member.id, member])), [team]);
  const shown = useMemo(() => sortTasks(filterTasks(tasks, filters), sort.key, sort.direction), [tasks, filters, sort]);
  const openTask = tasks.find((task) => task.id === openId) ?? null;
  const open = tasks.filter((task) => task.status !== "done").length;

  const onSort = (key: SortKey) => setSort((previous) => ({ key, direction: previous.key === key && previous.direction === "asc" ? "desc" : "asc" }));

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1680px] flex-1 flex-col gap-3 px-4 pt-4 pb-3 animate-page-in sm:px-6">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-2xl font-light leading-none tracking-[-0.02em]">{view === "table" ? "Tasks" : "Board"}</h1>
        {tasksQuery.isSuccess ? (
          <span className="text-sm text-muted-foreground tabular-nums">
            {open} open · {tasks.length} total
          </span>
        ) : null}
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? "Hide filters" : "Show filters"}
          title={expanded ? "Hide filters" : "Show filters"}
          onClick={() => setExpanded(!expanded)}
          className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors duration-75 hover:bg-secondary hover:text-foreground"
        >
          <ChevronDown className={cn("size-4 transition-transform duration-100", expanded && "rotate-180")} />
        </button>
        <div className="ml-auto flex items-center gap-2">
          <nav aria-label="View" className="flex rounded-full border border-[#e5e5e5] bg-background p-0.5">
            {(
              [
                { href: "/tasks", id: "table", label: "Table", Icon: Table2 },
                { href: "/board", id: "board", label: "Board", Icon: LayoutGrid },
              ] as const
            ).map(({ href, id, label, Icon }) => (
              <Link
                key={id}
                href={href}
                aria-current={view === id ? "page" : undefined}
                className={cn("flex h-7 items-center gap-1.5 rounded-full px-3 text-sm transition-colors duration-75", view === id ? "bg-primary text-primary-foreground" : "text-graphite hover:text-foreground")}
              >
                <Icon className="size-4" /> {label}
              </Link>
            ))}
          </nav>
          {canCreate ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus /> New task
              <kbd className="ml-0.5 hidden rounded-[4px] bg-background/20 px-1.5 font-mono text-[10px] sm:block">N</kbd>
            </Button>
          ) : null}
        </div>
      </div>

      {tasksQuery.isLoading ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3" aria-busy="true" aria-label="Loading tasks">
          <Skeleton className="h-9 w-80 rounded-full" />
          <div className="min-h-0 flex-1 space-y-px overflow-hidden rounded-[20px] border border-border">
            {Array.from({ length: 9 }).map((_, index) => (
              <Skeleton key={index} className="h-[58px] w-full rounded-none" />
            ))}
          </div>
        </div>
      ) : tasksQuery.isError ? (
        <EmptyState icon={Inbox} title="Could not load tasks" action={<Button variant="outline" onClick={() => tasksQuery.refetch()}>Try again</Button>} role="alert">
          Check your connection and try again.
        </EmptyState>
      ) : (
        <>
          <TaskFiltersBar tasks={tasks} team={team} filters={filters} onChange={setFilters} shown={shown.length} expanded={expanded} />
          {tasks.length === 0 ? (
            <EmptyState icon={Inbox} title="No tasks yet" data-testid="empty-state" action={canCreate ? <Button onClick={() => setCreating(true)}><Plus /> New task</Button> : undefined}>
              Ask Claude to sync the client channel and every request lands here, one row per thread. You can also add a task by hand.
            </EmptyState>
          ) : shown.length === 0 ? (
            <EmptyState icon={SearchX} title="No tasks match these filters" data-testid="no-match" action={<Button variant="outline" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</Button>}>
              Try removing a filter or searching for something broader.
            </EmptyState>
          ) : view === "table" ? (
            <TaskTable tasks={shown} team={teamById} sort={sort} onSort={onSort} onOpen={(task) => setOpenId(task.id)} activeId={openId} fetching={tasksQuery.isFetching} />
          ) : (
            <KanbanBoard tasks={shown} team={teamById} onOpen={(task) => setOpenId(task.id)} />
          )}
        </>
      )}

      <TaskDrawer task={openTask} tasks={tasks} team={team} onClose={() => setOpenId(null)} />
      <CreateTaskDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
