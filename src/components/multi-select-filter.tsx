"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type FilterOption<T extends string> = { value: T; label: string; count?: number };

export function MultiSelectFilter<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: FilterOption<T>[];
  selected: T[];
  onChange: (next: T[]) => void;
}) {
  const toggle = (value: T) => onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant={selected.length ? "secondary" : "outline"} size="sm" aria-label={`Filter by ${label}`} />}>
        {label}
        {selected.length ? <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">{selected.length}</span> : null}
        <ChevronDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 min-w-48 overflow-y-auto">
        {options.length === 0 ? <p className="px-2 py-1.5 text-xs text-muted-foreground">No options yet</p> : null}
        {options.map((option) => (
          <DropdownMenuCheckboxItem key={option.value} checked={selected.includes(option.value)} onCheckedChange={() => toggle(option.value)}>
            <span className="flex-1">{option.label}</span>
            {option.count !== undefined ? <span className="ml-3 text-xs text-muted-foreground tabular-nums">{option.count}</span> : null}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
