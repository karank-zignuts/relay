"use client";

import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { monthGrid, parseIsoDate, toIsoDate } from "@/lib/calendar";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTH_FORMAT = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const DISPLAY_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Themed calendar popover. Value is yyyy-mm-dd, or "" for none. Replaces <input type="date">. */
export function DatePicker({
  value,
  onValueChange,
  placeholder = "Pick a date",
  className,
  ...rest
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const selected = parseIsoDate(value);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => selected ?? new Date());
  const today = toIsoDate(new Date());
  const weeks = monthGrid(cursor.getFullYear(), cursor.getMonth());

  const shift = (months: number) => setCursor((previous) => new Date(previous.getFullYear(), previous.getMonth() + months, 1));
  const choose = (next: string) => {
    onValueChange(next);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setCursor(selected ?? new Date());
        setOpen(next);
      }}
    >
      <PopoverTrigger
        aria-label={rest["aria-label"]}
        className={cn(
          "group/date flex h-8 items-center gap-2 rounded-full border border-[#e5e5e5] bg-background px-3.5 text-sm outline-none",
          "transition-[border-color,background-color,box-shadow] duration-75 hover:border-ash hover:bg-secondary",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:border-ring",
          className,
        )}
      >
        <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
        <span className={cn(!selected && "text-muted-foreground")}>{selected ? DISPLAY_FORMAT.format(selected) : placeholder}</span>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[288px] gap-3 rounded-[12px] border border-border p-3 ring-0 shadow-[0_0_1px_rgba(0,0,0,0.4),0_4px_16px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between">
          <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="grid size-8 place-items-center rounded-full transition-colors hover:bg-secondary">
            <ChevronLeft className="size-4" />
          </button>
          <p className="text-sm font-medium" aria-live="polite">
            {MONTH_FORMAT.format(cursor)}
          </p>
          <button type="button" aria-label="Next month" onClick={() => shift(1)} className="grid size-8 place-items-center rounded-full transition-colors hover:bg-secondary">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <table className="w-full border-separate border-spacing-y-0.5 text-center text-sm" role="grid">
          <thead>
            <tr>
              {WEEKDAYS.map((day) => (
                <th key={day} scope="col" className="pb-1 text-xs font-normal text-muted-foreground">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, index) => (
              <tr key={index}>
                {week.map((day, column) => {
                  if (!day) return <td key={column} />;
                  const iso = toIsoDate(day);
                  const isSelected = iso === value;
                  return (
                    <td key={column} className="p-0">
                      <button
                        type="button"
                        onClick={() => choose(iso)}
                        aria-label={DISPLAY_FORMAT.format(day)}
                        aria-pressed={isSelected}
                        className={cn(
                          "mx-auto grid size-9 place-items-center rounded-full tabular-nums transition-colors duration-75",
                          isSelected ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
                          iso === today && !isSelected && "ring-1 ring-inset ring-ash",
                        )}
                      >
                        {day.getDate()}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-border pt-2.5">
          <button type="button" onClick={() => choose(today)} className="rounded-full px-3 py-1 text-sm transition-colors hover:bg-secondary">
            Today
          </button>
          {value ? (
            <button type="button" onClick={() => choose("")} className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <X className="size-3.5" /> Clear
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
