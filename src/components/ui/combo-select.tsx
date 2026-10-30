"use client";

import { Check, ChevronDown, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ComboOption = { value: string; label: string; icon?: React.ReactNode };

type Common = {
  options: readonly ComboOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  /** Lets the person type a value that is not in the list. */
  creatable?: boolean;
  /** Single mode: adds a first row that clears the value, e.g. "No module". */
  clearLabel?: string;
  /** Defaults to on when the list is long. */
  searchable?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  align?: "start" | "center" | "end";
  /** Replaces the field-style button, e.g. an avatar or a priority glyph. */
  trigger?: React.ReactElement<Record<string, unknown>>;
  "aria-label"?: string;
  /** Called when a brand-new value is created, so the list can learn it. */
  onCreate?: (value: string) => void;
};

type Single = Common & { multiple?: false; value: string; onValueChange: (value: string) => void };
type Multiple = Common & { multiple: true; values: string[]; onValuesChange: (values: string[]) => void };

const CLEAR = "\u0000clear";

/**
 * Searchable dropdown, single or multi select, with optional "create new". The one picker used for modules,
 * tags, assignees and inline table edits. Keyboard: type to search, arrows to move, Enter to pick, Esc to close.
 */
export function ComboSelect(props: Single | Multiple) {
  const { options, placeholder = "Select…", searchPlaceholder = "Search…", creatable, clearLabel, disabled, id, className, align = "start", trigger, onCreate } = props;
  const multiple = props.multiple === true;
  const selected = useMemo(() => (props.multiple ? props.values : props.value ? [props.value] : []), [props]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const searchable = props.searchable ?? (options.length > 7 || creatable === true);

  const needle = query.trim().toLowerCase();
  const rows = useMemo(() => {
    const list: ComboOption[] = options.filter((option) => !needle || option.label.toLowerCase().includes(needle));
    const exact = options.some((option) => option.label.toLowerCase() === needle);
    const extra: ComboOption[] = [];
    if (!multiple && clearLabel && !needle) extra.push({ value: CLEAR, label: clearLabel });
    if (creatable && needle && !exact) list.push({ value: `\u0000new:${query.trim()}`, label: `Create “${query.trim()}”`, icon: <Plus className="size-4" aria-hidden /> });
    return [...extra, ...list];
  }, [options, needle, query, creatable, clearLabel, multiple]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function onListKey(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, rows.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (rows[active]) choose(rows[active]);
    }
  }

  function choose(row: ComboOption) {
    const created = row.value.startsWith("\u0000new:") ? row.value.slice(5) : null;
    const value = created ?? row.value;
    if (created) onCreate?.(created);
    if (props.multiple) {
      props.onValuesChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
      setQuery("");
    } else {
      props.onValueChange(value === CLEAR ? "" : value);
      setOpen(false);
    }
  }

  const labelOf = (value: string) => options.find((option) => option.value === value)?.label ?? value;
  const current = options.find((option) => option.value === selected[0]);

  const fieldTrigger = (
    <button
      type="button"
      id={id}
      aria-label={props["aria-label"]}
      className={cn(
        "group/combo flex min-h-9 w-full min-w-0 items-center justify-between gap-2 rounded-[4px] border border-input bg-transparent px-2.5 py-1 text-left text-sm outline-none select-none",
        "transition-[border-color,box-shadow] duration-75 hover:border-ash focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:border-ring data-popup-open:ring-3 data-popup-open:ring-ring/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {multiple ? (
          selected.length ? (
            selected.map((value) => (
              <span key={value} className="inline-flex items-center gap-1 rounded-full bg-secondary py-0.5 pr-1 pl-2.5 text-xs">
                {labelOf(value)}
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Remove ${labelOf(value)}`}
                  className="grid size-4 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-stone hover:text-foreground"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (props.multiple && !disabled) props.onValuesChange(selected.filter((item) => item !== value));
                  }}
                >
                  <X className="size-3" />
                </span>
              </span>
            ))
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )
        ) : (
          <span className="flex min-w-0 items-center gap-2">
            {current?.icon}
            <span className={cn("truncate", !current && "text-muted-foreground")}>{current ? current.label : selected[0] || placeholder}</span>
          </span>
        )}
      </span>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-100 group-data-popup-open/combo:rotate-180" aria-hidden />
    </button>
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (disabled) return;
        setOpen(next);
        setQuery("");
        setActive(0);
      }}
    >
      <PopoverTrigger render={trigger ?? fieldTrigger} disabled={disabled} />
      <PopoverContent align={align} sideOffset={6} className="w-(--anchor-width) min-w-60 gap-1 p-1.5">
        {searchable ? (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              ref={(node) => node?.focus({ preventScroll: true })}
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onListKey}
              className="h-9 w-full rounded-[8px] bg-secondary pr-2.5 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>
        ) : null}
        <div ref={listRef} role="listbox" aria-multiselectable={multiple} className="max-h-64 overflow-y-auto" tabIndex={searchable ? -1 : 0} onKeyDown={searchable ? undefined : onListKey}>
          {rows.length === 0 ? <p className="px-2.5 py-3 text-center text-xs text-muted-foreground">No matches</p> : null}
          {rows.map((row, index) => {
            const isSelected = row.value === CLEAR ? selected.length === 0 : selected.includes(row.value);
            return (
              <div
                key={row.value}
                role="option"
                aria-selected={isSelected}
                data-index={index}
                data-active={index === active || undefined}
                onClick={() => choose(row)}
                onPointerMove={() => setActive(index)}
                className="flex items-center gap-2 rounded-[8px] py-2 pr-2 pl-2.5 text-sm transition-colors duration-75 select-none data-active:bg-secondary aria-selected:font-medium"
              >
                {row.icon}
                <span className="flex-1 truncate">{row.label}</span>
                {isSelected ? <Check className="size-4" aria-hidden /> : null}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
