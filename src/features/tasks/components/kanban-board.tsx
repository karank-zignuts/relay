"use client";

import { GripVertical, MessageSquare, Paperclip } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/components/session-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { Tip } from "@/components/ui/tip";
import { taskEditScope } from "@/lib/auth/task-permissions";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, STATUSES, type TaskStatus } from "../constants";
import type { SortState, TaskFilters } from "../filters";
import { useBoardColumn, useMoveTask } from "../queries";
import { assigneeIds, attachmentCount, commentCount, type Task, type TeamMember } from "../types";
import { AssigneeCell, ModuleCell, PriorityCell } from "./task-cells";
import { BoardMinimap } from "./board-minimap";
import { StatusGlyph } from "./task-chips";

type Drag = { task: Task; height: number };
type Over = { status: TaskStatus; slot: number } | null;

/** Cards in the shape of real cards, so the board does not shift when data arrives. */
export function BoardSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="-mx-4 flex min-h-[320px] min-w-0 flex-1 gap-3 overflow-hidden px-4 pb-1 sm:-mx-6 sm:px-6" aria-busy="true" aria-label="Loading board">
      {STATUSES.slice(0, columns).map((status, column) => (
        <section key={status} className="flex h-full min-h-0 w-[300px] shrink-0 flex-col gap-2 rounded-[20px] bg-secondary p-3">
          <div className="flex items-center gap-2 px-1.5 pt-1 pb-2">
            <Skeleton className="size-3.5 rounded-full bg-stone" />
            <Skeleton className="h-3.5 w-20 bg-stone" />
            <Skeleton className="ml-auto h-5 w-7 rounded-full bg-stone" />
          </div>
          <div className="flex flex-col gap-2 overflow-hidden">
            {Array.from({ length: column === 3 || column === 4 ? 1 : 4 }).map((_, row) => (
              <CardSkeleton key={row} lines={(row + column) % 3 === 0 ? 3 : 2} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CardSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="rounded-[12px] border border-border bg-background p-3.5">
      <Skeleton className="h-3 w-8" />
      <div className="mt-2 space-y-1.5">
        {Array.from({ length: lines }).map((_, line) => (
          <Skeleton key={line} className={cn("h-3.5", line === lines - 1 ? "w-2/3" : "w-full")} />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Skeleton className="size-3.5" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="ml-auto size-6 rounded-full" />
      </div>
    </div>
  );
}

export function KanbanBoard({
  filters,
  sort,
  hideDone,
  team,
  members,
  onOpen,
  onTotals,
}: {
  filters: TaskFilters;
  sort: SortState;
  hideDone: boolean;
  team: Map<string, TeamMember>;
  members: TeamMember[];
  onOpen: (task: Task) => void;
  onTotals?: (total: number) => void;
}) {
  const user = useSession();
  const move = useMoveTask();
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<Over>(null);
  const [totals, setTotals] = useState<Partial<Record<TaskStatus, number>>>({});
  const scroller = useRef<HTMLDivElement>(null);
  const scrollerId = useId();
  const columns = STATUSES.filter((status) => !(hideDone && status === "done") && (filters.status.length === 0 || filters.status.includes(status)));
  const manual = sort === null;

  useEffect(() => {
    onTotals?.(columns.reduce((sum, status) => sum + (totals[status] ?? 0), 0));
  }, [totals, columns, onTotals]);

  // Sideways movement belongs to the whole board and never to a column: a two-finger sideways swipe, or Shift + wheel, scrolls the
  // board wherever the pointer is. A plain vertical wheel still scrolls the column under it. Needs a non-passive listener to cancel.
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      const sideways = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.shiftKey ? event.deltaY : 0;
      if (!sideways) return;
      event.preventDefault();
      element.scrollLeft += sideways;
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  function drop(status: TaskStatus, rows: Task[]) {
    const current = drag;
    const target = over;
    setDrag(null);
    setOver(null);
    if (!current || !target || target.status !== status) return;
    const { task } = current;
    if (taskEditScope(user.role, user.id, assigneeIds(task)) === "none") {
      toast.error("You cannot change this task's status.");
      return;
    }
    const without = rows.filter((row) => row.id !== task.id);
    const from = rows.findIndex((row) => row.id === task.id);
    const index = manual ? (from !== -1 && from < target.slot ? target.slot - 1 : target.slot) : 0;
    if (task.status === status && (!manual || (from !== -1 && index === from))) return;
    const previous = without[index - 1];
    const next = without[index];
    const rank = !manual
      ? task.board_rank
      : previous && next
        ? (previous.board_rank + next.board_rank) / 2
        : previous
          ? previous.board_rank + 1
          : next
            ? next.board_rank - 1
            : task.board_rank;
    move.mutate({ task, status, index, rank });
  }

  return (
    <div className="relative -mx-4 flex min-h-[320px] min-w-0 flex-1 sm:-mx-6">
      <div ref={scroller} id={scrollerId} className="flex min-h-0 min-w-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden px-4 pb-1 sm:px-6" data-testid="kanban">
        {columns.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            filters={filters}
            sort={sort}
            team={team}
            members={members}
            drag={drag}
            over={over}
            manual={manual}
            onOver={setOver}
            onDragStart={setDrag}
            onDragEnd={() => {
              setDrag(null);
              setOver(null);
            }}
            onDrop={drop}
            onOpen={onOpen}
            onTotal={(total) => setTotals((previous) => (previous[status] === total ? previous : { ...previous, [status]: total }))}
          />
        ))}
      </div>
      <BoardMinimap scroller={scroller} controls={scrollerId} columns={columns.length} />
    </div>
  );
}

function BoardColumn({
  status,
  filters,
  sort,
  team,
  members,
  drag,
  over,
  manual,
  onOver,
  onDragStart,
  onDragEnd,
  onDrop,
  onOpen,
  onTotal,
}: {
  status: TaskStatus;
  filters: TaskFilters;
  sort: SortState;
  team: Map<string, TeamMember>;
  members: TeamMember[];
  drag: Drag | null;
  over: Over;
  manual: boolean;
  onOver: (over: Over) => void;
  onDragStart: (drag: Drag) => void;
  onDragEnd: () => void;
  onDrop: (status: TaskStatus, rows: Task[]) => void;
  onOpen: (task: Task) => void;
  onTotal: (total: number) => void;
}) {
  const query = useBoardColumn(status, filters, sort);
  const rows = useMemo(() => query.data?.pages.flatMap((page) => page.rows) ?? [], [query.data]);
  const total = query.data?.pages[0]?.total ?? 0;
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isOver = drag !== null && over?.status === status;
  const slot = isOver ? over.slot : -1;

  useEffect(() => {
    if (query.data) onTotal(total);
  }, [query.data, total, onTotal]);

  // Load the next 20 cards when the end of the column scrolls into view.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root || !hasNextPage) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && !isFetchingNextPage && void fetchNextPage(), { root, rootMargin: "160px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, rows.length]);

  const placeholder = drag ? (
    <div aria-hidden style={{ height: drag.height }} className="shrink-0 animate-drop-in rounded-[12px] border border-dashed border-ember/70 bg-ember/5" data-testid="drop-placeholder" />
  ) : null;

  const showPlaceholderAt = (index: number) => isOver && manual && slot === index;

  return (
    <section
      aria-label={`${STATUS_LABELS[status]} column`}
      data-testid={`column-${status}`}
      onDragEnter={(event) => event.preventDefault()}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        // Over the empty space under the cards: the drop goes last. Cards set their own slot first and stop the event.
        if (!(over?.status === status)) onOver({ status, slot: rows.length });
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) onOver(null);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(status, rows);
      }}
      className={cn(
        "flex h-full min-h-0 w-[300px] shrink-0 flex-col gap-2 rounded-[20px] p-3 transition-[background-color,box-shadow] duration-150",
        isOver ? "bg-stone/70 shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--ember)_45%,transparent)]" : "bg-secondary",
      )}
    >
      <h2 className="flex items-center gap-2 px-1.5 pt-1 pb-2 text-sm font-medium">
        <StatusGlyph status={status} />
        {STATUS_LABELS[status]}
        <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-xs font-normal text-muted-foreground tabular-nums" data-testid={`count-${status}`}>
          {query.data ? total : "–"}
        </span>
      </h2>
      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto overscroll-y-contain pr-0.5" data-testid="column-scroll">
        {query.isLoading ? (
          <>
            <CardSkeleton lines={3} />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : null}

        {query.isSuccess && rows.length === 0 ? (
          isOver && manual ? (
            placeholder
          ) : (
            <p className={cn("rounded-[12px] border border-dashed border-ash/60 px-3 py-8 text-center text-xs text-muted-foreground transition-colors duration-100", isOver && "border-ember/70 text-foreground")}>{isOver ? "Drop to move here" : "Nothing here"}</p>
          )
        ) : null}

        {rows.map((task, index) => (
          <div key={task.id} className="contents">
            {showPlaceholderAt(index) ? placeholder : null}
            <article
              draggable
              data-testid="kanban-card"
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", task.id);
                event.dataTransfer.effectAllowed = "move";
                const height = event.currentTarget.offsetHeight;
                setTimeout(() => onDragStart({ task, height }), 0);
              }}
              onDragEnd={onDragEnd}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                event.dataTransfer.dropEffect = "move";
                const box = event.currentTarget.getBoundingClientRect();
                const next = event.clientY < box.top + box.height / 2 ? index : index + 1;
                if (!over || over.status !== status || over.slot !== next) onOver({ status, slot: next });
              }}
              className={cn(
                "group/card relative rounded-[12px] border border-border bg-background p-3.5 text-sm transition-[border-color,opacity,transform,box-shadow] duration-100 ease-out hover:border-ash hover:shadow-[0_1px_0_rgba(0,0,0,0.03)]",
                drag?.task.id === task.id && "scale-[0.98] opacity-40",
                task.id.startsWith("pending-") && "opacity-60",
              )}
            >
              <GripVertical className="absolute top-3.5 right-2 size-4 text-ash opacity-0 transition-opacity duration-100 group-hover/card:opacity-100" aria-hidden />
              {/* Not a <button>: browsers will not start a drag from a button inside a draggable card. */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => onOpen(task)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(task);
                  }
                }}
                className="block w-full rounded-[6px] text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                <span className="font-mono text-xs text-muted-foreground">{task.task_number > 0 ? `#${task.task_number}` : "…"}</span>
                <span className="mt-0.5 block pr-5 font-medium leading-snug">{task.title}</span>
              </div>
              {/* The chips pull 6px past their text for a roomy hover area, so the gap must be wider than 12px and nothing here may clip (no overflow-hidden on the module wrapper). */}
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <PriorityCell task={task} compact />
                <span className="min-w-0">
                  <ModuleCell task={task} />
                </span>
                {commentCount(task) > 0 ? (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <MessageSquare className="size-3" aria-hidden /> {commentCount(task)}
                  </span>
                ) : null}
                {attachmentCount(task) > 0 ? (
                  <Tip label="Has attachments">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Paperclip className="size-3" aria-hidden /> {attachmentCount(task)}
                    </span>
                  </Tip>
                ) : null}
                <span className="ml-auto">
                  <AssigneeCell task={task} team={team} members={members} />
                </span>
              </div>
            </article>
          </div>
        ))}
        {showPlaceholderAt(rows.length) && rows.length > 0 ? placeholder : null}

        {query.hasNextPage ? (
          <div ref={sentinelRef} className="flex flex-col gap-2 pb-1">
            {isFetchingNextPage ? <CardSkeleton /> : <div className="h-1" />}
          </div>
        ) : null}
      </div>
    </section>
  );
}
