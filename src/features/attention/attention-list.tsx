"use client";

import { Check, ExternalLink, Inbox, PartyPopper, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isAwaitingReply, isForgotten, type WorkingHours } from "@/lib/attention";
import { formatAge, formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TaskDrawer } from "@/features/tasks/components/task-drawer";
import { useAppSettings, useDismissReply, useTasks, useTasksRealtime, useTeam } from "@/features/tasks/queries";
import type { Task } from "@/features/tasks/types";

type Tab = "all" | "forgotten";

export function AttentionList() {
  useTasksRealtime();
  const tasksQuery = useTasks();
  const settingsQuery = useAppSettings();
  const teamQuery = useTeam();
  const dismiss = useDismissReply();
  const [tab, setTab] = useState<Tab>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const settings = settingsQuery.data;

  const { waiting, forgotten } = useMemo(() => {
    const hours: WorkingHours | null = settings
      ? { start: settings.working_hours_start.slice(0, 5), end: settings.working_hours_end.slice(0, 5), timeZone: settings.working_hours_timezone }
      : null;
    const now = new Date();
    const open = tasks.filter((task) => task.status !== "done" && isAwaitingReply(task));
    const sorted = [...open].sort((a, b) => Date.parse(a.last_client_message_at!) - Date.parse(b.last_client_message_at!));
    const forgottenIds = new Set(hours && settings ? sorted.filter((task) => isForgotten(task, now, settings.forgotten_reply_hours, hours)).map((task) => task.id) : []);
    return { waiting: sorted, forgotten: forgottenIds };
  }, [tasks, settings]);

  const rows: Task[] = tab === "forgotten" ? waiting.filter((task) => forgotten.has(task.id)) : waiting;
  const dismissed = useMemo(
    () => tasks.filter((task) => task.reply_dismissed_at && task.last_client_message_at && !isAwaitingReply(task) && Date.parse(task.reply_dismissed_at) >= Date.parse(task.last_client_message_at) && !(task.last_team_reply_at && Date.parse(task.last_team_reply_at) >= Date.parse(task.last_client_message_at))),
    [tasks],
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 animate-page-in sm:px-8">
      <div>
        <h1 className="text-[32px] leading-[1.13] font-light tracking-[-0.02em]">Needs attention</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Threads where the client spoke last. “Forgotten” means no team reply for {settings?.forgotten_reply_hours ?? 4} working hours.
        </p>
      </div>

      <div role="tablist" aria-label="Reply status" className="flex gap-2">
        {(["all", "forgotten"] as const).map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn("rounded-full border border-border px-4 py-1 text-sm", tab === value ? "bg-secondary font-medium" : "text-muted-foreground")}
          >
            {value === "all" ? "Unreplied" : "Forgotten"}{" "}
            <span className="tabular-nums" data-testid={`count-${value}`}>
              {value === "all" ? waiting.length : forgotten.size}
            </span>
          </button>
        ))}
      </div>

      {tasksQuery.isLoading ? (
        <div className="space-y-px overflow-hidden rounded-[20px] border border-border" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[76px] w-full rounded-none" />
          ))}
        </div>
      ) : tasksQuery.isError ? (
        <EmptyState icon={Inbox} title="Could not load threads" role="alert" action={<Button variant="outline" onClick={() => tasksQuery.refetch()}>Try again</Button>}>
          Check your connection and try again.
        </EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState icon={PartyPopper} title={tab === "forgotten" ? "Nothing forgotten" : "Every thread has a reply"} data-testid="attention-empty">
          New client messages appear here after the next sync.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[20px] border border-border bg-background" data-testid="attention-list">
          {rows.map((task) => (
            <li key={task.id} className="group flex flex-wrap items-center gap-x-5 gap-y-2 p-5 transition-colors duration-150 hover:bg-secondary/60" data-testid="attention-row">
              <div className="w-24 shrink-0">
                <p className="text-2xl leading-none font-light tracking-[-0.02em] whitespace-nowrap tabular-nums" title={`Client wrote ${formatDateTime(task.last_client_message_at!)}`}>
                  {formatAge(task.last_client_message_at!)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">waiting</p>
              </div>
              <div className="min-w-0 flex-1">
                <button type="button" className="text-left font-medium underline-offset-4 hover:underline" onClick={() => setOpenId(task.id)}>
                  <span className="font-mono text-xs font-normal text-muted-foreground">#{task.task_number}</span> {task.title}
                </button>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  {forgotten.has(task.id) ? (
                    <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                      <span className="size-1.5 rounded-full bg-ember" aria-hidden /> Forgotten
                    </span>
                  ) : null}
                  <span>{task.last_team_reply_at ? `Last team reply ${formatRelative(task.last_team_reply_at)}` : "No team reply yet"}</span>
                  {task.module ? <span>· {task.module}</span> : null}
                </p>
              </div>
              {task.slack_url ? (
                <a href={task.slack_url} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Reply in Slack <ExternalLink />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ) : null}
              <Button variant="ghost" size="sm" disabled={dismiss.isPending} onClick={() => dismiss.mutate({ taskId: task.id, dismissed: true })}>
                <Check /> No reply needed
              </Button>
            </li>
          ))}
        </ul>
      )}

      {dismissed.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Marked “no reply needed” ({dismissed.length})</summary>
          <ul className="mt-2 space-y-1">
            {dismissed.map((task) => (
              <li key={task.id} className="flex items-center gap-2">
                <span className="truncate">
                  #{task.task_number} {task.title}
                </span>
                <Button variant="ghost" size="xs" onClick={() => dismiss.mutate({ taskId: task.id, dismissed: false })}>
                  <Undo2 /> Undo
                </Button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <TaskDrawer task={tasks.find((task) => task.id === openId) ?? null} tasks={tasks} team={teamQuery.data ?? []} onClose={() => setOpenId(null)} />
    </div>
  );
}
