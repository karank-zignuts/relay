"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { OptionSelect } from "@/components/ui/option-select";
import { cn } from "@/lib/utils";
import { AREA_LABELS, CHANGE_AREAS, ENV_LABELS, ENVIRONMENTS, PRIORITIES, PRIORITY_LABELS, STATUS_LABELS, STATUSES } from "../constants";
import { activeFilterCount, EMPTY_FILTERS, UNASSIGNED, type TaskFilters } from "../filters";
import { assigneeIds, type Task, type TeamMember } from "../types";

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((item) => b.includes(item));

export function TaskFiltersBar({
  tasks,
  team,
  filters,
  onChange,
  shown,
  expanded,
}: {
  tasks: Task[];
  team: TeamMember[];
  filters: TaskFilters;
  onChange: (next: TaskFilters) => void;
  shown: number;
  expanded: boolean;
}) {
  const user = useSession();
  const set = <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => onChange({ ...filters, [key]: value });
  const active = activeFilterCount(filters);
  const moreActive = filters.jira !== "any" || filters.level !== "all" || filters.from !== "" || filters.to !== "";
  const [moreOpen, setMoreOpen] = useState(false);

  const modules = useMemo(() => [...new Set(tasks.map((task) => task.module).filter((value): value is string => Boolean(value)))].sort(), [tasks]);
  const tags = useMemo(() => [...new Set(tasks.flatMap((task) => task.tags))].sort(), [tasks]);
  const counts = useMemo(() => {
    const status = new Map<string, number>();
    const assignee = new Map<string, number>();
    for (const task of tasks) {
      status.set(task.status, (status.get(task.status) ?? 0) + 1);
      const ids = assigneeIds(task);
      if (ids.length === 0) assignee.set(UNASSIGNED, (assignee.get(UNASSIGNED) ?? 0) + 1);
      ids.forEach((id) => assignee.set(id, (assignee.get(id) ?? 0) + 1));
    }
    return { status, assignee };
  }, [tasks]);

  // One-tap views. Each toggles a single filter, so they combine with everything else.
  const views = [
    { label: "Mine", on: sameList(filters.assignee, [user.id]), toggle: () => set("assignee", sameList(filters.assignee, [user.id]) ? [] : [user.id]) },
    { label: "Unassigned", on: sameList(filters.assignee, [UNASSIGNED]), toggle: () => set("assignee", sameList(filters.assignee, [UNASSIGNED]) ? [] : [UNASSIGNED]) },
    { label: "Blocked", on: sameList(filters.status, ["blocked"]), toggle: () => set("status", sameList(filters.status, ["blocked"]) ? [] : ["blocked"]) },
    { label: "Urgent", on: sameList(filters.priority, ["urgent"]), toggle: () => set("priority", sameList(filters.priority, ["urgent"]) ? [] : ["urgent"]) },
    { label: "Hide done", on: filters.hideDone, toggle: () => set("hideDone", !filters.hideDone) },
  ];

  const memberName = (id: string) => (id === UNASSIGNED ? "Unassigned" : team.find((member) => member.id === id)?.full_name || "Someone");
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...filters.status.map((value) => ({ key: `s-${value}`, label: STATUS_LABELS[value], remove: () => set("status", filters.status.filter((item) => item !== value)) })),
    ...filters.priority.map((value) => ({ key: `p-${value}`, label: PRIORITY_LABELS[value], remove: () => set("priority", filters.priority.filter((item) => item !== value)) })),
    ...filters.assignee.map((value) => ({ key: `a-${value}`, label: memberName(value), remove: () => set("assignee", filters.assignee.filter((item) => item !== value)) })),
    ...filters.module.map((value) => ({ key: `m-${value}`, label: value, remove: () => set("module", filters.module.filter((item) => item !== value)) })),
    ...filters.env.map((value) => ({ key: `e-${value}`, label: ENV_LABELS[value], remove: () => set("env", filters.env.filter((item) => item !== value)) })),
    ...filters.area.map((value) => ({ key: `c-${value}`, label: `${AREA_LABELS[value]} changes`, remove: () => set("area", filters.area.filter((item) => item !== value)) })),
    ...filters.tag.map((value) => ({ key: `t-${value}`, label: `#${value}`, remove: () => set("tag", filters.tag.filter((item) => item !== value)) })),
  ];

  return (
    <div className="shrink-0 space-y-3" role="search" aria-label="Filter tasks">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="task-search"
            aria-label="Search tasks"
            placeholder="Search title, #number, module, Jira…"
            className="h-9 rounded-full pr-9 pl-9"
            value={filters.search}
            onChange={(event) => set("search", event.target.value)}
          />
          <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-[4px] bg-secondary px-1.5 font-mono text-[10px] text-muted-foreground sm:block">/</kbd>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick views">
          {views.map((view) => (
            <button
              key={view.label}
              type="button"
              aria-pressed={view.on}
              onClick={view.toggle}
              className={cn(
                "h-8 rounded-full border px-3.5 text-sm transition-[background-color,border-color,color,transform] duration-75 ease-out active:scale-[0.97]",
                view.on ? "border-primary bg-primary text-primary-foreground" : "border-[#e5e5e5] bg-background text-graphite hover:border-ash hover:bg-secondary",
              )}
            >
              {view.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-sm text-muted-foreground tabular-nums" data-testid="task-count">
          {shown} of {tasks.length} tasks
        </span>
      </div>

      {expanded ? (
        <div className="space-y-3 animate-pop">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFilter label="Status" selected={filters.status} onChange={(value) => set("status", value)} options={STATUSES.map((value) => ({ value, label: STATUS_LABELS[value], count: counts.status.get(value) ?? 0 }))} />
        <MultiSelectFilter label="Priority" selected={filters.priority} onChange={(value) => set("priority", value)} options={PRIORITIES.map((value) => ({ value, label: PRIORITY_LABELS[value] }))} />
        <MultiSelectFilter
          label="Assignee"
          selected={filters.assignee}
          onChange={(value) => set("assignee", value)}
          options={[
            { value: UNASSIGNED, label: "Unassigned", count: counts.assignee.get(UNASSIGNED) ?? 0 },
            ...team.filter((member) => member.is_active).map((member) => ({ value: member.id, label: member.full_name || member.email, count: counts.assignee.get(member.id) ?? 0 })),
          ]}
        />
        <MultiSelectFilter label="Module" selected={filters.module} onChange={(value) => set("module", value)} options={modules.map((value) => ({ value, label: value }))} />
        <MultiSelectFilter label="Environment" selected={filters.env} onChange={(value) => set("env", value)} options={ENVIRONMENTS.map((value) => ({ value, label: ENV_LABELS[value] }))} />
        <MultiSelectFilter label="Changes in" selected={filters.area} onChange={(value) => set("area", value)} options={CHANGE_AREAS.map((value) => ({ value, label: AREA_LABELS[value] }))} />
        <MultiSelectFilter label="Tag" selected={filters.tag} onChange={(value) => set("tag", value)} options={tags.map((value) => ({ value, label: value }))} />
        <Button variant={moreActive ? "secondary" : "ghost"} size="sm" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}>
          <SlidersHorizontal /> More
        </Button>
      </div>

      {moreOpen || moreActive ? (
        <div className="flex flex-wrap items-center gap-2 text-sm animate-pop">
          <OptionSelect
            variant="pill"
            aria-label="Jira filter"
            value={filters.jira}
            onValueChange={(value) => set("jira", value)}
            options={[
              { value: "any", label: "Jira: any" },
              { value: "yes", label: "Has Jira ticket" },
              { value: "no", label: "No Jira ticket" },
            ]}
          />
          <OptionSelect
            variant="pill"
            aria-label="Task level"
            value={filters.level}
            onValueChange={(value) => set("level", value)}
            options={[
              { value: "all", label: "All tasks" },
              { value: "parents", label: "Parent tasks only" },
              { value: "subtasks", label: "Sub-tasks only" },
            ]}
          />
          <span className="flex items-center gap-1.5 text-muted-foreground">
            From
            <DatePicker aria-label="From date" placeholder="Any date" value={filters.from} onValueChange={(value) => set("from", value)} />
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            To
            <DatePicker aria-label="To date" placeholder="Any date" value={filters.to} onValueChange={(value) => set("to", value)} />
          </span>
        </div>
      ) : null}

        </div>
      ) : null}

      {chips.length > 0 || active > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          {chips.map((chip) => (
            <span key={chip.key} className="inline-flex items-center gap-1 rounded-full bg-secondary py-0.5 pr-1 pl-3 text-xs animate-pop">
              {chip.label}
              <button type="button" aria-label={`Remove filter ${chip.label}`} onClick={chip.remove} className="grid size-5 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-stone hover:text-foreground">
                <X className="size-3" />
              </button>
            </span>
          ))}
          <Button variant="ghost" size="xs" onClick={() => onChange(EMPTY_FILTERS)}>
            Clear {active} {active === 1 ? "filter" : "filters"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
