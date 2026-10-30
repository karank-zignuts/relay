"use client";

import { ChevronDown, Inbox, LayoutGrid, Plus, SearchX, Table2, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/ui/tip";
import { can } from "@/lib/auth/roles";
import { useDebounced } from "@/lib/use-debounced";
import { usePersisted } from "@/lib/use-persisted";
import { cn } from "@/lib/utils";
import { SORT_LABELS } from "../constants";
import { activeFilterCount, EMPTY_FILTERS, nextSort, toRpcArgs, type SortKey, type SortState, type TaskFilters } from "../filters";
import { useTask, useTaskCounts, useTaskPage, useTeam } from "../queries";
import { CreateTaskDialog } from "./create-task-dialog";
import { BoardSkeleton, KanbanBoard } from "./kanban-board";
import { TaskDrawer } from "./task-drawer";
import { TaskFiltersBar } from "./task-filters-bar";
import { TaskTable, TaskTableSkeleton } from "./task-table";

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

const VIEWS = [
  { href: "/tasks", id: "table", label: "Table", Icon: Table2 },
  { href: "/board", id: "board", label: "Board", Icon: LayoutGrid },
] as const;

export function TasksWorkspace({ children }: { children?: React.ReactNode }) {
  const user = useSession();
  const pathname = usePathname();
  const routeView: "table" | "board" = pathname.startsWith("/board") ? "board" : "table";
  // The route changes a moment after the click. Show the chosen view at once, so the highlight never lingers on the old one.
  const [chosen, setChosen] = useState<{ view: "table" | "board"; from: string } | null>(null);
  const view = chosen && chosen.from === pathname ? chosen.view : routeView;

  const [filters, setFiltersRaw] = useState<TaskFilters>(EMPTY_FILTERS);
  const [sort, setSortRaw] = useState<SortState>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSizeRaw] = usePersisted<number>("relay.page-size", 50);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [threadsOpen, setThreadsOpen] = usePersisted<boolean>("relay.threads-open", false);
  const [boardTotal, setBoardTotal] = useState<number | null>(null);
  // The header is compact by default so the work area gets the screen. The arrow next to the title opens the filters.
  const [expanded, setExpanded] = usePersisted<boolean>("relay.filters-open", false);
  const canCreate = can(user.role, "tasks.create");

  const setFilters = (next: TaskFilters) => {
    setFiltersRaw(next);
    setPage(0);
  };
  const setSort = (next: SortState) => {
    setSortRaw(next);
    setPage(0);
  };

  // Typing searches on the server, but only once the typing pauses.
  const search = useDebounced(filters.search, 250);
  const applied = useMemo(() => ({ ...filters, search }), [filters, search]);

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

  const teamQuery = useTeam();
  const countsQuery = useTaskCounts();
  const args = useMemo(() => toRpcArgs(applied, sort, { limit: pageSize, offset: page * pageSize }, { group: true }), [applied, sort, pageSize, page]);
  const pageQuery = useTaskPage(args, view === "table");
  const openQuery = useTask(openId);

  const team = useMemo(() => teamQuery.data ?? [], [teamQuery.data]);
  const teamById = useMemo(() => new Map(team.map((member) => [member.id, member])), [team]);
  const counts = countsQuery.data;
  const filtered = activeFilterCount(applied) > 0;

  const onSort = (key: SortKey) => setSort(nextSort(sort, key));
  const shown = view === "table" ? (pageQuery.data?.total ?? null) : boardTotal;
  const members = useMemo(() => team.filter((member) => member.is_active), [team]);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1680px] flex-1 flex-col gap-3 px-4 pt-4 pb-3 sm:px-6">
      {children}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-2xl font-light leading-none tracking-[-0.02em]">{view === "table" ? "Tasks" : "Board"}</h1>
        <span className="min-w-[8.5rem] text-sm text-muted-foreground tabular-nums">{counts ? `${counts.open} open · ${counts.all} total` : ""}</span>
        <Tip label={expanded ? "Hide filters" : "Show filters"}>
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? "Hide filters" : "Show filters"}
            onClick={() => setExpanded(!expanded)}
            className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors duration-75 hover:bg-secondary hover:text-foreground"
          >
            <ChevronDown className={cn("size-4 transition-transform duration-200 ease-out-quint", expanded && "rotate-180")} />
          </button>
        </Tip>
        <div className="ml-auto flex items-center gap-2">
          <nav aria-label="View" className="relative flex rounded-full border border-stone bg-background p-0.5">
            {VIEWS.map(({ href, id, label, Icon }) => (
              <Link
                key={id}
                href={href}
                aria-current={view === id ? "page" : undefined}
                onClick={() => setChosen({ view: id, from: pathname })}
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

      <TaskFiltersBar team={team} filters={filters} onChange={setFilters} shown={shown} all={counts?.all ?? null} expanded={expanded} />

      {view === "board" && sort ? (
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          Sorted by {SORT_LABELS[sort.key].toLowerCase()} ({sort.direction === "asc" ? "ascending" : "descending"}). Dragging a card changes its status only.
          <Button variant="ghost" size="xs" onClick={() => setSort(null)}>
            <X /> Back to manual order
          </Button>
        </div>
      ) : null}

      <div key={view} className="flex min-h-0 flex-1 flex-col animate-page-in">
        {view === "table" ? (
          pageQuery.isError ? (
            <EmptyState icon={Inbox} title="Could not load tasks" action={<Button variant="outline" onClick={() => pageQuery.refetch()}>Try again</Button>} role="alert">
              Check your connection and try again.
            </EmptyState>
          ) : pageQuery.isPending ? (
            <TaskTableSkeleton />
          ) : pageQuery.data.total === 0 ? (
            filtered ? (
              <EmptyState icon={SearchX} title="No tasks match these filters" data-testid="no-match" action={<Button variant="outline" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</Button>}>
                Try removing a filter or searching for something broader.
              </EmptyState>
            ) : (
              <EmptyState icon={Inbox} title="No tasks yet" data-testid="empty-state" action={canCreate ? <Button onClick={() => setCreating(true)}><Plus /> New task</Button> : undefined}>
                Ask Claude to sync the client channel and every request lands here, one row per thread. You can also add a task by hand.
              </EmptyState>
            )
          ) : (
            <TaskTable
              tasks={pageQuery.data.rows}
              total={pageQuery.data.total}
              team={teamById}
              members={members}
              sort={sort}
              onSort={onSort}
              page={page}
              pageSize={pageSize}
              onPage={setPage}
              onPageSize={(size) => {
                setPageSizeRaw(size);
                setPage(0);
              }}
              onOpen={(task) => setOpenId(task.id)}
              activeId={openId}
              fetching={pageQuery.isFetching}
              threadsOpen={threadsOpen}
              onThreadsOpen={setThreadsOpen}
            />
          )
        ) : teamQuery.isPending ? (
          <BoardSkeleton />
        ) : (
          <KanbanBoard filters={applied} sort={sort} hideDone={filters.hideDone} team={teamById} members={members} onOpen={(task) => setOpenId(task.id)} onTotals={setBoardTotal} />
        )}
      </div>

      <TaskDrawer task={openQuery.data ?? null} onClose={() => setOpenId(null)} team={team} />
      <CreateTaskDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
