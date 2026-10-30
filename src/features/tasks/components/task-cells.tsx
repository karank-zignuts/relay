"use client";

import { Plus } from "lucide-react";
import { useMemo } from "react";
import { useSession } from "@/components/session-provider";
import { ComboSelect } from "@/components/ui/combo-select";
import { Tip } from "@/components/ui/tip";
import { taskEditScope } from "@/lib/auth/task-permissions";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PRIORITY_LABELS } from "../constants";
import { useModules, useSetAssignees, useUpdateTask } from "../queries";
import { assigneeIds, type Task, type TeamMember } from "../types";
import { AssigneeStack, PriorityChip, PriorityGlyph, StatusChip } from "./task-chips";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "./task-options";

/** Clicks and keys inside these cells must not open the task. Portals bubble through React, so this also covers their pop-ups. */
function Stop({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={className} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      {children}
    </span>
  );
}

const editable = "-mx-1.5 rounded-full px-1.5 py-1 transition-colors duration-75 hover:bg-secondary data-popup-open:bg-secondary";

export function AssigneeCell({ task, team, members, showName }: { task: Task; team: Map<string, TeamMember>; members: TeamMember[]; showName?: boolean }) {
  const user = useSession();
  const setAssignees = useSetAssignees();
  const canAssign = user.role === "super_admin" || user.role === "project_manager";
  const ids = assigneeIds(task);
  const stack = <AssigneeStack ids={ids} team={team} showName={showName} />;
  const options = useMemo(
    () =>
      members
        .filter((member) => member.is_active || ids.includes(member.id))
        .map((member) => ({
          value: member.id,
          label: member.full_name || member.email,
          icon: <span className="grid size-5 place-items-center rounded-full bg-stone text-[9px] font-medium text-graphite">{initials(member.full_name || member.email)}</span>,
        })),
    [members, ids],
  );
  if (!canAssign) return stack;
  return (
    <Stop>
      <ComboSelect
        multiple
        values={ids}
        onValuesChange={(next) => setAssignees.mutate({ taskId: task.id, current: ids, next })}
        options={options}
        searchable={false}
        align="start"
        aria-label={`Change assignees of task ${task.task_number}`}
        trigger={
          <button type="button" aria-label={`Change assignees of task ${task.task_number}`} className={cn(editable, "inline-flex items-center gap-2")}>
            <Tip label={ids.length ? "Change assignees" : "Unassigned. Click to assign"}>
              <span className="inline-flex items-center gap-2 hover:[&_[role=img]]:border-foreground">{stack}</span>
            </Tip>
          </button>
        }
      />
    </Stop>
  );
}

export function PriorityCell({ task, compact = false }: { task: Task; compact?: boolean }) {
  const user = useSession();
  const update = useUpdateTask();
  const chip = compact ? (
    <Tip label={`Priority: ${PRIORITY_LABELS[task.priority]}`}>
      <span role="img" aria-label={`Priority ${PRIORITY_LABELS[task.priority]}`}>
        <PriorityGlyph priority={task.priority} />
      </span>
    </Tip>
  ) : (
    <PriorityChip priority={task.priority} />
  );
  if (taskEditScope(user.role, user.id, assigneeIds(task)) !== "all") return chip;
  return (
    <Stop>
      <ComboSelect
        value={task.priority}
        onValueChange={(priority) => priority && update.mutate({ id: task.id, patch: { priority: priority as Task["priority"] } })}
        options={PRIORITY_OPTIONS.map((option) => ({ value: option.value, label: option.label, icon: option.icon }))}
        searchable={false}
        aria-label={`Change priority of task ${task.task_number}`}
        trigger={
          <button type="button" aria-label={`Change priority of task ${task.task_number}`} className={editable}>
            {compact ? chip : (
              <Tip label={`Priority: ${PRIORITY_LABELS[task.priority]}. Click to change`}>
                <span>{chip}</span>
              </Tip>
            )}
          </button>
        }
      />
    </Stop>
  );
}

export function StatusCell({ task }: { task: Task }) {
  const user = useSession();
  const update = useUpdateTask();
  const chip = <StatusChip status={task.status} />;
  if (taskEditScope(user.role, user.id, assigneeIds(task)) === "none") return chip;
  return (
    <Stop>
      <ComboSelect
        value={task.status}
        onValueChange={(status) => status && update.mutate({ id: task.id, patch: { status: status as Task["status"] } })}
        options={STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label, icon: option.icon }))}
        searchable={false}
        aria-label={`Change status of task ${task.task_number}`}
        trigger={
          <button type="button" aria-label={`Change status of task ${task.task_number}`} className={editable}>
            <Tip label="Change status">
              <span>{chip}</span>
            </Tip>
          </button>
        }
      />
    </Stop>
  );
}

export function ModuleCell({ task }: { task: Task }) {
  const user = useSession();
  const update = useUpdateTask();
  const { data: modules = [] } = useModules();
  const label = task.module ? <span className="text-graphite">{task.module}</span> : <span className="text-muted-foreground">—</span>;
  if (taskEditScope(user.role, user.id, assigneeIds(task)) !== "all") return label;
  return (
    <Stop>
      <ComboSelect
        value={task.module ?? ""}
        onValueChange={(module) => update.mutate({ id: task.id, patch: { module: module || null } })}
        options={modules.map((name) => ({ value: name, label: name }))}
        creatable
        clearLabel="No module"
        searchPlaceholder="Find or add a module…"
        aria-label={`Change module of task ${task.task_number}`}
        trigger={
          <button type="button" aria-label={`Change module of task ${task.task_number}`} className={cn(editable, "inline-flex items-center gap-1")}>
            <Tip label={task.module ? "Change module" : "Add a module"}>
              <span className="inline-flex items-center gap-1">
                {label}
                {task.module ? null : <Plus className="size-3 text-muted-foreground" aria-hidden />}
              </span>
            </Tip>
          </button>
        }
      />
    </Stop>
  );
}
