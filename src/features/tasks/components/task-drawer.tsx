"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptionSelect } from "@/components/ui/option-select";
import { ComboSelect } from "@/components/ui/combo-select";
import { Tip } from "@/components/ui/tip";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { isAwaitingReply } from "@/lib/attention";
import { taskEditScope } from "@/lib/auth/task-permissions";
import { formatDateTime, initials } from "@/lib/format";
import { usePersisted } from "@/lib/use-persisted";
import { cn } from "@/lib/utils";
import { AREA_LABELS, BASE_TAGS, CHANGE_AREAS, ENV_LABELS, ENVIRONMENTS, type TaskChangeArea, type TaskEnv, type TaskPriority, type TaskStatus } from "../constants";
import { taskKeys, useDismissReply, useModules, useSetAssignees, useTags, useTaskLite, useUpdateTask } from "../queries";
import { assigneeIds, type Task, type TeamMember } from "../types";
import { StatusChip } from "./task-chips";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "./task-options";
import { TaskAttachments } from "./task-attachments";
import { TaskComments } from "./task-comments";

// OptionSelect needs a real value for "no parent", so the form keeps "" and the select uses this.
const NO_PARENT = "none";

type FormState = {
  title: string;
  description: string;
  module: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
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
  tags: task.tags,
  environments: task.environments,
  changes_in: task.changes_in,
  jira_key: task.jira_key ?? "",
  jira_url: task.jira_url ?? "",
  jira_status: task.jira_status ?? "",
  parent_task_id: task.parent_task_id ?? "",
  assignees: assigneeIds(task),
});

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((item) => b.includes(item));

function TogglePill({ checked, onChange, disabled, children }: { checked: boolean; onChange: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <label
      className={cn(
        "inline-flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-full border px-3 text-sm transition-[background-color,border-color,color,transform] duration-75 ease-out has-focus-visible:ring-3 has-focus-visible:ring-ring/50 active:scale-[0.97]",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-stone bg-background text-graphite hover:border-ash hover:bg-secondary",
        disabled && "cursor-not-allowed opacity-50 active:scale-100",
      )}
    >
      <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={onChange} />
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

const DRAWER_DEFAULT = 600;
const DRAWER_MIN = 420;
const DRAWER_WIDE = 880;
/**
 * Closing by dragging is deliberate. The panel stops at its minimum width; pulling further past it shows resistance,
 * and once the pull passes ARM the handle turns Ember and says "Release to close". A long pull closes it at once.
 */
const PULL_ARM = 56;
const PULL_FORCE = 240;

const maxWidth = () => Math.round(Math.min(1100, window.innerWidth * 0.92));
const clampWidth = (width: number) => Math.round(Math.min(Math.max(width, DRAWER_MIN), maxWidth()));

export function TaskDrawer({ task, team, onClose }: { task: Task | null; team: TeamMember[]; onClose: () => void }) {
  const [width, setWidth] = usePersisted<number>("relay.drawer-width", DRAWER_DEFAULT);
  const [live, setLive] = useState<number | null>(null); // width while dragging, so we save once on release
  // While the panel slides away after a drag-close it keeps the width it had, so it does not jump back to full size.
  const [frozen, setFrozen] = useState<number | null>(null);
  const [pull, setPull] = useState(0); // how far past the minimum width the pointer is
  const armed = pull >= PULL_ARM;
  const dragging = useRef(false);
  const shown = frozen ?? live ?? width;

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = true;
    setLive(width);
  }

  function closeNow(event: React.PointerEvent<HTMLDivElement>) {
    dragging.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setFrozen(DRAWER_MIN);
    setLive(null);
    setPull(0);
    onClose();
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const raw = window.innerWidth - event.clientX;
    if (raw >= DRAWER_MIN) {
      setPull(0);
      setLive(Math.min(raw, maxWidth()));
      return;
    }
    const next = DRAWER_MIN - raw;
    if (next >= PULL_FORCE) return closeNow(event);
    setLive(DRAWER_MIN);
    setPull(next);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    if (armed) return closeNow(event);
    dragging.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const final = live === null ? width : clampWidth(live);
    setLive(null);
    setPull(0);
    setWidth(final);
  }

  return (
    <Sheet open={Boolean(task)} onOpenChange={(open) => !open && onClose()} onOpenChangeComplete={(open) => !open && setFrozen(null)}>
      <SheetContent
        style={{ width: shown, maxWidth: "100vw", transform: pull > 0 ? `translateX(${Math.round(pull * 0.4)}px)` : undefined }}
        className={cn("gap-0 p-0 data-[side=right]:sm:max-w-none", live !== null && "select-none transition-none")}
        data-testid="task-drawer"
      >
        <Tip label="Drag to resize · double-click to widen" side="left">
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panel"
            aria-valuenow={shown}
            aria-valuemin={DRAWER_MIN}
            tabIndex={0}
            data-testid="drawer-resize"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={() => setWidth(width >= DRAWER_WIDE - 40 ? DRAWER_DEFAULT : clampWidth(DRAWER_WIDE))}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") setWidth(clampWidth(width + 32));
              if (event.key === "ArrowRight") setWidth(clampWidth(width - 32));
            }}
            className="group/resize absolute inset-y-0 -left-2 z-30 flex w-4 touch-none items-stretch justify-center outline-none"
          >
            <span
              className={cn(
                "w-0.5 rounded-full bg-transparent transition-[background-color,width] duration-100 group-hover/resize:w-[3px] group-hover/resize:bg-foreground/70 group-focus-visible/resize:bg-foreground/70",
                live !== null && "w-[3px] bg-foreground",
                pull > 0 && !armed && "w-[3px] bg-ember/50",
                armed && "w-1 bg-ember",
              )}
            />
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-1/2 right-[calc(100%+4px)] -translate-y-1/2 rounded-full bg-ember px-3 py-1.5 text-xs font-medium whitespace-nowrap text-white shadow-[0_4px_16px_rgba(0,0,0,0.16)] transition-[opacity,transform] duration-100",
                armed ? "translate-x-0 opacity-100" : "translate-x-2 opacity-0",
              )}
            >
              Release to close
            </span>
          </div>
        </Tip>
        <div className="h-full overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]" style={pull > 0 ? { opacity: 1 - Math.min(pull / PULL_FORCE, 1) * 0.55 } : undefined}>{task ? <DrawerBody key={task.id} task={task} team={team} onClose={onClose} /> : null}</div>
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ task, team, onClose }: { task: Task; team: TeamMember[]; onClose: () => void }) {
  const user = useSession();
  const scope = taskEditScope(user.role, user.id, assigneeIds(task));
  const canEditAll = scope === "all";
  const canAssign = user.role === "super_admin" || user.role === "project_manager";
  const [form, setForm] = useState<FormState>(() => toForm(task));
  const updateTask = useUpdateTask();
  const setAssignees = useSetAssignees();
  const dismiss = useDismissReply();

  const queryClient = useQueryClient();
  const { data: moduleNames = [] } = useModules();
  const { data: tagNames = [] } = useTags();
  const { data: lite = [] } = useTaskLite();
  const moduleOptions = useMemo(() => [...new Set([...moduleNames, ...(form.module ? [form.module] : [])])].sort((a, b) => a.localeCompare(b)).map((name) => ({ value: name, label: name })), [moduleNames, form.module]);
  const tagOptions = useMemo(() => [...new Set([...BASE_TAGS, ...tagNames, ...form.tags])].sort().map((name) => ({ value: name, label: name })), [tagNames, form.tags]);
  const hasChildren = lite.some((item) => item.parent_task_id === task.id);
  const parentOptions = lite.filter((item) => item.id !== task.id && !item.parent_task_id);
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
      if (!sameSet(form.tags, initial.tags)) patch.tags = form.tags;
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
              <OptionSelect id="task-status" value={form.status} disabled={scope === "none"} onValueChange={(status) => setForm({ ...form, status })} options={STATUS_OPTIONS} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-priority">Priority</Label>
              <OptionSelect id="task-priority" value={form.priority} disabled={!canEditAll} onValueChange={(priority) => setForm({ ...form, priority })} options={PRIORITY_OPTIONS} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-module">Module</Label>
              <ComboSelect
                id="task-module"
                value={form.module}
                disabled={!canEditAll}
                onValueChange={(module) => setForm({ ...form, module })}
                options={moduleOptions}
                creatable
                clearLabel="No module"
                placeholder="Choose a module"
                searchPlaceholder="Find or add a module…"
                onCreate={(name) => queryClient.setQueryData<string[]>(taskKeys.modules, (names = []) => (names.includes(name) ? names : [...names, name]))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-tags">Tags</Label>
              <ComboSelect
                multiple
                id="task-tags"
                values={form.tags}
                disabled={!canEditAll}
                onValuesChange={(tags) => setForm({ ...form, tags })}
                options={tagOptions}
                creatable
                placeholder="Add tags"
                searchPlaceholder="Find or add a tag…"
              />
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
            <OptionSelect
              id="task-parent"
              value={form.parent_task_id || NO_PARENT}
              disabled={!canEditAll || hasChildren}
              onValueChange={(next) => setForm({ ...form, parent_task_id: next === NO_PARENT ? "" : next })}
              options={[{ value: NO_PARENT, label: "None" }, ...parentOptions.map((item) => ({ value: item.id, label: `#${item.task_number} ${item.title}` }))]}
            />
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
        <TaskAttachments taskId={task.id} />

        <hr className="border-border" />
        <TaskComments taskId={task.id} />
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-popover px-6 py-4">
        <span className={cn("flex items-center gap-2 text-xs text-muted-foreground transition-opacity duration-100", dirty ? "opacity-100" : "opacity-0")} aria-live="polite">
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
