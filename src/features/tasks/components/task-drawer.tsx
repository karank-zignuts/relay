"use client";

import { Check, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { isAwaitingReply } from "@/lib/attention";
import { taskEditScope } from "@/lib/auth/task-permissions";
import { formatDateTime, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AREA_LABELS, CHANGE_AREAS, ENV_LABELS, ENVIRONMENTS, PRIORITIES, PRIORITY_LABELS, STATUS_LABELS, STATUSES, type TaskChangeArea, type TaskEnv, type TaskPriority, type TaskStatus } from "../constants";
import { useDismissReply, useSetAssignees, useUpdateTask } from "../queries";
import { assigneeIds, type Task, type TeamMember } from "../types";
import { StatusChip } from "./task-chips";
import { TaskComments } from "./task-comments";

type FormState = {
  title: string;
  description: string;
  module: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string;
  environments: TaskEnv[];
  changes_in: TaskChangeArea[];
  jira_key: string;
  jira_url: string;
  jira_status: string;
  parent_task_id: string;
  assignees: string[];
};

const toForm = (task: Task): FormState => ({
  title: task.title,
  description: task.description,
  module: task.module ?? "",
  status: task.status,
  priority: task.priority,
  tags: task.tags.join(", "),
  environments: task.environments,
  changes_in: task.changes_in,
  jira_key: task.jira_key ?? "",
  jira_url: task.jira_url ?? "",
  jira_status: task.jira_status ?? "",
  parent_task_id: task.parent_task_id ?? "",
  assignees: assigneeIds(task),
});

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((item) => b.includes(item));
const parseTags = (value: string) => [...new Set(value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))];

function TogglePill({ checked, onChange, disabled, children }: { checked: boolean; onChange: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <label
      className={cn(
        "inline-flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-full border px-3 text-sm transition-[background-color,border-color,color,transform] duration-150 ease-out has-focus-visible:ring-3 has-focus-visible:ring-ring/50 active:scale-[0.97]",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-[#e5e5e5] bg-background text-graphite hover:border-ash hover:bg-secondary",
        disabled && "cursor-not-allowed opacity-50 active:scale-100",
      )}
    >
      <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={onChange} />
      {checked ? <Check className="size-3.5" aria-hidden /> : null}
      {children}
    </label>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function TaskDrawer({ task, tasks, team, onClose }: { task: Task | null; tasks: Task[]; team: TeamMember[]; onClose: () => void }) {
  return (
    <Sheet open={Boolean(task)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[560px]" data-testid="task-drawer">
        {task ? <DrawerBody key={task.id} task={task} tasks={tasks} team={team} onClose={onClose} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ task, tasks, team, onClose }: { task: Task; tasks: Task[]; team: TeamMember[]; onClose: () => void }) {
  const user = useSession();
  const scope = taskEditScope(user.role, user.id, assigneeIds(task));
  const canEditAll = scope === "all";
  const canAssign = user.role === "super_admin" || user.role === "project_manager";
  const [form, setForm] = useState<FormState>(() => toForm(task));
  const updateTask = useUpdateTask();
  const setAssignees = useSetAssignees();
  const dismiss = useDismissReply();

  const modules = useMemo(() => [...new Set(tasks.map((item) => item.module).filter((value): value is string => Boolean(value)))].sort(), [tasks]);
  const hasChildren = tasks.some((item) => item.parent_task_id === task.id);
  const parentOptions = tasks.filter((item) => item.id !== task.id && !item.parent_task_id);
  const initial = useMemo(() => toForm(task), [task]);

  const toggle = <K extends "environments" | "changes_in" | "assignees">(key: K, value: FormState[K][number]) =>
    setForm((previous) => {
      const list = previous[key] as string[];
      const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
      return { ...previous, [key]: next };
    });

  async function save() {
    if (!form.title.trim()) return toast.error("A task needs a title.");

    const patch: Parameters<typeof updateTask.mutateAsync>[0]["patch"] = {};
    if (form.status !== initial.status) patch.status = form.status;
    if (canEditAll) {
      if (form.title.trim() !== initial.title) patch.title = form.title.trim();
      if (form.description !== initial.description) patch.description = form.description;
      if (form.module.trim() !== initial.module) patch.module = form.module.trim() || null;
      if (form.priority !== initial.priority) patch.priority = form.priority;
      if (form.tags !== initial.tags) patch.tags = parseTags(form.tags);
      if (!sameSet(form.environments, initial.environments)) patch.environments = form.environments;
      if (!sameSet(form.changes_in, initial.changes_in)) patch.changes_in = form.changes_in;
      if (form.jira_key.trim() !== initial.jira_key) patch.jira_key = form.jira_key.trim() || null;
      if (form.jira_url.trim() !== initial.jira_url) patch.jira_url = form.jira_url.trim() || null;
      if (form.jira_status.trim() !== initial.jira_status) patch.jira_status = form.jira_status.trim() || null;
      if (form.parent_task_id !== initial.parent_task_id) patch.parent_task_id = form.parent_task_id || null;
    }

    const assigneesChanged = canAssign && !sameSet(form.assignees, initial.assignees);
    if (Object.keys(patch).length === 0 && !assigneesChanged) return toast.message("Nothing to save.");

    try {
      if (Object.keys(patch).length) await updateTask.mutateAsync({ id: task.id, patch });
      if (assigneesChanged) await setAssignees.mutateAsync({ taskId: task.id, current: initial.assignees, next: form.assignees });
      toast.success("Task saved");
      onClose();
    } catch {
      // The mutation hooks already show the error toast.
    }
  }

  const saving = updateTask.isPending || setAssignees.isPending;
  const activeTeam = team.filter((member) => member.is_active || form.assignees.includes(member.id));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  // Cmd/Ctrl+S saves without reaching for the mouse.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (dirty && scope !== "none") void save();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex min-h-full flex-col">
      <SheetHeader className="gap-2 border-b border-border p-6 pr-14">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">#{task.task_number}</span>
          <StatusChip status={form.status} />
        </div>
        <SheetTitle className="text-2xl font-light leading-tight tracking-[-0.02em]">{task.title}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span>{formatDateTime(task.task_date)}</span>
          {task.slack_url ? (
            <a href={task.slack_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline">
              Open in Slack <ExternalLink className="size-3" aria-hidden />
            </a>
          ) : null}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-7 p-6">
        {isAwaitingReply(task) ? (
          <div className="flex items-center justify-between gap-3 rounded-[12px] bg-secondary p-3.5 text-sm animate-pop" data-testid="awaiting-reply">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-ember" aria-hidden /> The client is waiting for a reply on this thread.
            </span>
            <Button size="sm" variant="outline" disabled={dismiss.isPending} onClick={() => dismiss.mutate({ taskId: task.id, dismissed: true })}>
              No reply needed
            </Button>
          </div>
        ) : null}

        {scope === "none" ? <p className="text-sm text-muted-foreground">You have read-only access to this task.</p> : null}
        {scope === "status_only" ? <p className="rounded-[12px] bg-secondary p-3.5 text-sm text-graphite">You can change this task&apos;s status. Other fields are read-only for your role.</p> : null}

        <Section title="Details">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" value={form.title} disabled={!canEditAll} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-description">Description</Label>
            <Textarea id="task-description" rows={5} value={form.description} disabled={!canEditAll} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="task-status">Status</Label>
              <NativeSelect id="task-status" value={form.status} disabled={scope === "none"} onChange={(event) => setForm({ ...form, status: event.target.value as TaskStatus })}>
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-priority">Priority</Label>
              <NativeSelect id="task-priority" value={form.priority} disabled={!canEditAll} onChange={(event) => setForm({ ...form, priority: event.target.value as TaskPriority })}>
                {PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {PRIORITY_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-module">Module</Label>
              <Input id="task-module" list="task-modules" value={form.module} disabled={!canEditAll} onChange={(event) => setForm({ ...form, module: event.target.value })} />
              <datalist id="task-modules">
                {modules.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-tags">Tags</Label>
              <Input id="task-tags" placeholder="bug, suggestion" value={form.tags} disabled={!canEditAll} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
            </div>
          </div>
        </Section>

        <Section title="Assignees" hint={canAssign ? "Auto-filled from Slack mentions when a Slack ID is mapped." : "Only Super Admin and Project Manager can change assignees."}>
          {activeTeam.length === 0 ? <p className="text-xs text-muted-foreground">No team members yet.</p> : null}
          <div className="flex flex-wrap gap-2">
            {activeTeam.map((member) => (
              <TogglePill key={member.id} checked={form.assignees.includes(member.id)} disabled={!canAssign} onChange={() => toggle("assignees", member.id)}>
                <span className="grid size-5 place-items-center rounded-full bg-stone text-[9px] font-medium text-graphite">{initials(member.full_name || member.email)}</span>
                {member.full_name || member.email}
              </TogglePill>
            ))}
          </div>
        </Section>

        <Section title="Deployment" hint="Where this change is right now. Pick every environment it is in.">
          <div className="flex flex-wrap gap-2">
            {ENVIRONMENTS.map((value) => (
              <TogglePill key={value} checked={form.environments.includes(value)} disabled={!canEditAll} onChange={() => toggle("environments", value)}>
                {ENV_LABELS[value]}
              </TogglePill>
            ))}
          </div>
          <div className="space-y-2 pt-1">
            <p className="text-sm font-medium">Changes in</p>
            <div className="flex flex-wrap gap-2">
              {CHANGE_AREAS.map((value) => (
                <TogglePill key={value} checked={form.changes_in.includes(value)} disabled={!canEditAll} onChange={() => toggle("changes_in", value)}>
                  {AREA_LABELS[value]}
                </TogglePill>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Links">
          <div className="space-y-1.5">
            <Label htmlFor="task-parent">Parent task</Label>
            <NativeSelect id="task-parent" value={form.parent_task_id} disabled={!canEditAll || hasChildren} onChange={(event) => setForm({ ...form, parent_task_id: event.target.value })}>
              <option value="">None</option>
              {parentOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  #{item.task_number} {item.title}
                </option>
              ))}
            </NativeSelect>
            {hasChildren ? <p className="text-xs text-muted-foreground">This task has sub-tasks, so it cannot become a sub-task itself.</p> : null}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="jira-key">Jira key</Label>
              <Input id="jira-key" placeholder="ABC-123" className="font-mono" value={form.jira_key} disabled={!canEditAll} onChange={(event) => setForm({ ...form, jira_key: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jira-status">Jira status</Label>
              <Input id="jira-status" value={form.jira_status} disabled={!canEditAll} onChange={(event) => setForm({ ...form, jira_status: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jira-url">Jira link</Label>
              <Input id="jira-url" type="url" value={form.jira_url} disabled={!canEditAll} onChange={(event) => setForm({ ...form, jira_url: event.target.value })} />
            </div>
          </div>
        </Section>

        <hr className="border-border" />
        <TaskComments taskId={task.id} />
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-popover px-6 py-4">
        <span className={cn("flex items-center gap-2 text-xs text-muted-foreground transition-opacity duration-200", dirty ? "opacity-100" : "opacity-0")} aria-live="polite">
          <span className="size-1.5 rounded-full bg-ember" aria-hidden /> Unsaved changes
          <kbd className="rounded-[4px] bg-secondary px-1.5 font-mono text-[10px]">⌘S</kbd>
        </span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={save} disabled={saving || scope === "none"}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
