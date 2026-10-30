import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tip } from "@/components/ui/tip";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AREA_LABELS, ENV_LABELS, ENVIRONMENTS, PRIORITY_LABELS, STATUS_LABELS, type TaskChangeArea, type TaskEnv, type TaskPriority, type TaskStatus } from "../constants";
import type { TeamMember } from "../types";

// Visual language (DESIGN_SYSTEM.md §5.3): meaning is carried by SHAPE first, color second.
// Everything is achromatic except Ember, which is reserved for "blocked" and "urgent".

const INK = "var(--foreground)";
const SMOKE = "var(--muted-foreground)";
const ASH = "var(--ash)";
const EMBER = "var(--ember)";
const STONE = "var(--stone)";

export function StatusGlyph({ status, className }: { status: TaskStatus; className?: string }) {
  const common = { width: 14, height: 14, viewBox: "0 0 14 14", fill: "none", "aria-hidden": true, className: cn("shrink-0", className) } as const;
  switch (status) {
    case "backlog":
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="5.5" stroke={ASH} strokeWidth="1.5" strokeDasharray="2.2 2.2" />
        </svg>
      );
    case "to_do":
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="5.5" stroke={SMOKE} strokeWidth="1.5" />
        </svg>
      );
    case "in_progress":
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="5.5" stroke={INK} strokeWidth="1.5" />
          <path d="M7 3.5a3.5 3.5 0 0 1 0 7Z" fill={INK} />
        </svg>
      );
    case "in_review":
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="5.5" stroke={INK} strokeWidth="1.5" />
          <circle cx="7" cy="7" r="2" fill={INK} />
        </svg>
      );
    case "blocked":
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="6.25" fill={EMBER} />
          <path d="M4.5 7h5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "done":
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="6.25" fill={INK} />
          <path d="m4.4 7.2 1.8 1.8 3.4-3.6" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

export function StatusChip({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-sm", status === "done" && "text-muted-foreground", className)} data-testid="status-chip">
      <StatusGlyph status={status} /> {STATUS_LABELS[status]}
    </span>
  );
}

const PRIORITY_LEVEL: Record<TaskPriority, number> = { low: 1, medium: 2, high: 3, urgent: 3 };

export function PriorityGlyph({ priority }: { priority: TaskPriority }) {
  const level = PRIORITY_LEVEL[priority];
  const fill = priority === "urgent" ? EMBER : INK;
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="shrink-0">
      {[0, 1, 2].map((index) => (
        <rect key={index} x={1 + index * 4.5} y={9 - index * 3.5} width="3" height={4 + index * 3.5} rx="0.8" fill={index < level ? fill : STONE} />
      ))}
    </svg>
  );
}

export function PriorityChip({ priority, className }: { priority: TaskPriority; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-sm", className)}>
      <PriorityGlyph priority={priority} /> {PRIORITY_LABELS[priority]}
    </span>
  );
}

/** Four fixed slots in pipeline order, so "where is this deployed?" reads as a pattern, not a sentence. */
export function EnvStrip({ values }: { values: TaskEnv[] }) {
  if (values.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`Deployed in ${values.map((value) => ENV_LABELS[value]).join(", ")}`}>
      {ENVIRONMENTS.map((env) => {
        const on = values.includes(env);
        return (
          <Tip key={env} label={`${ENV_LABELS[env]}${on ? "" : " (not deployed)"}`}>
          <span
            className={cn(
              "grid size-[22px] place-items-center rounded-[6px] font-mono text-[10px] font-medium uppercase transition-colors",
              on ? "bg-primary text-primary-foreground" : "bg-transparent text-ash ring-1 ring-inset ring-border",
            )}
          >
            {env[0]}
            {on ? <span className="sr-only">{ENV_LABELS[env]}</span> : null}
          </span>
          </Tip>
        );
      })}
    </span>
  );
}

export function AreaTags({ values }: { values: TaskChangeArea[] }) {
  if (values.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {values.map((value) => (
        <span key={value} className="rounded-[6px] px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-graphite ring-1 ring-inset ring-border">
          {AREA_LABELS[value]}
        </span>
      ))}
    </span>
  );
}

export function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-graphite">
          {tag}
        </span>
      ))}
    </span>
  );
}

export const envLabels = (values: TaskEnv[]) => values.map((value) => ENV_LABELS[value]);
export const areaLabels = (values: TaskChangeArea[]) => values.map((value) => AREA_LABELS[value]);

export function ChipList({ items, emptyLabel = "—" }: { items: string[]; emptyLabel?: string }) {
  if (items.length === 0) return <span className="text-muted-foreground">{emptyLabel}</span>;
  return <span className="flex flex-wrap gap-1">{items.map((item) => <span key={item} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{item}</span>)}</span>;
}

/** Same size as an avatar, with a question mark: "nobody yet". */
export function UnassignedAvatar({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Unassigned"
      className={cn("grid size-6 shrink-0 place-items-center rounded-full border border-dashed border-ash bg-background text-[11px] font-medium text-muted-foreground transition-colors", className)}
    >
      ?
    </span>
  );
}

export function AssigneeStack({ ids, team, showName = false }: { ids: string[]; team: Map<string, TeamMember>; showName?: boolean }) {
  if (ids.length === 0) return <UnassignedAvatar />;
  const names = ids.map((id) => team.get(id)?.full_name || team.get(id)?.email || "Unknown");
  return (
    <span className="inline-flex items-center gap-2" aria-label={names.join(", ")}>
      <span className="flex -space-x-1">
        {ids.slice(0, 3).map((id, index) => (
          <Avatar key={id} className="size-6 ring-2 ring-background after:hidden">
            <AvatarFallback className="text-[10px]">{initials(names[index])}</AvatarFallback>
          </Avatar>
        ))}
      </span>
      {ids.length > 3 ? <span className="text-xs text-muted-foreground">+{ids.length - 3}</span> : null}
      {showName && ids.length === 1 ? <span className="text-sm">{names[0].split(" ")[0]}</span> : null}
    </span>
  );
}
