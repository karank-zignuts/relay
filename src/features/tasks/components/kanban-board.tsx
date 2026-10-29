"use client";

import { GripVertical, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/components/session-provider";
import { taskEditScope } from "@/lib/auth/task-permissions";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, STATUSES, type TaskStatus } from "../constants";
import { useUpdateTask } from "../queries";
import { assigneeIds, commentCount, type Task, type TeamMember } from "../types";
import { AssigneeStack, PriorityGlyph, StatusGlyph } from "./task-chips";

export function KanbanBoard({ tasks, team, onOpen }: { tasks: Task[]; team: Map<string, TeamMember>; onOpen: (task: Task) => void }) {
  const user = useSession();
  const updateTask = useUpdateTask();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);

  function drop(event: React.DragEvent, status: TaskStatus) {
    event.preventDefault();
    setOver(null);
    // The id travels in the drag data: re-rendering the card during dragstart makes Chrome cancel the drag.
    const task = tasks.find((item) => item.id === event.dataTransfer.getData("text/plain"));
    setDragging(null);
    if (!task || task.status === status) return;
    if (taskEditScope(user.role, user.id, assigneeIds(task)) === "none") {
      toast.error("You cannot change this task's status.");
      return;
    }
    updateTask.mutate({ id: task.id, patch: { status } });
  }

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-6 sm:-mx-8 sm:px-8" data-testid="kanban">
      {STATUSES.map((status) => {
        const column = tasks.filter((task) => task.status === status);
        const isOver = over === status && dragging !== null;
        return (
          <section
            key={status}
            aria-label={`${STATUS_LABELS[status]} column`}
            data-testid={`column-${status}`}
            onDragEnter={(event) => event.preventDefault()}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setOver(status);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver((previous) => (previous === status ? null : previous));
            }}
            onDrop={(event) => drop(event, status)}
            className={cn(
              "flex w-[300px] shrink-0 snap-start flex-col gap-2 rounded-[20px] p-3 transition-[background-color,box-shadow] duration-200",
              isOver ? "bg-stone shadow-[inset_0_0_0_1.5px_var(--ring)]" : "bg-secondary",
            )}
          >
            <h2 className="flex items-center gap-2 px-1.5 pt-1 pb-2 text-sm font-medium">
              <StatusGlyph status={status} />
              {STATUS_LABELS[status]}
              <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-xs font-normal text-muted-foreground tabular-nums">{column.length}</span>
            </h2>
            {column.length === 0 ? (
              <p className={cn("rounded-[12px] border border-dashed border-ash/60 px-3 py-8 text-center text-xs text-muted-foreground transition-colors", isOver && "border-ring text-foreground")}>
                {isOver ? "Drop to move here" : "Nothing here"}
              </p>
            ) : null}
            {column.map((task) => (
              <article
                key={task.id}
                draggable
                data-testid="kanban-card"
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", task.id);
                  event.dataTransfer.effectAllowed = "move";
                  setTimeout(() => setDragging(task.id), 0);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setOver(null);
                }}
                className={cn(
                  "group/card relative cursor-grab rounded-[12px] border border-border bg-background p-3.5 text-sm transition-[border-color,opacity,transform] duration-150 ease-out hover:border-ash active:cursor-grabbing",
                  dragging === task.id && "scale-[0.98] opacity-40",
                )}
              >
                <GripVertical className="absolute top-3.5 right-2 size-4 text-ash opacity-0 transition-opacity group-hover/card:opacity-100" aria-hidden />
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
                  className="block w-full cursor-pointer rounded-[6px] text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="font-mono text-xs text-muted-foreground">#{task.task_number}</span>
                  <span className="mt-0.5 block pr-5 font-medium leading-snug">{task.title}</span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <PriorityGlyph priority={task.priority} />
                  {task.module ? <span className="truncate text-graphite">{task.module}</span> : null}
                  {commentCount(task) > 0 ? (
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <MessageSquare className="size-3" aria-hidden /> {commentCount(task)}
                    </span>
                  ) : null}
                  <span className="ml-auto">
                    <AssigneeStack ids={assigneeIds(task)} team={team} />
                  </span>
                </div>
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}
