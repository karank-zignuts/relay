"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
  /** Optional leading visual, e.g. a status glyph. Shown in the list and in the closed trigger. */
  icon?: React.ReactNode;
  disabled?: boolean;
};

type OptionSelectProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SelectOption<T>[];
  id?: string;
  "aria-label"?: string;
  placeholder?: string;
  disabled?: boolean;
  /** `field` matches inputs in forms. `pill` matches filter buttons. */
  variant?: "field" | "pill";
  className?: string;
  align?: "start" | "center" | "end";
};

/**
 * The one dropdown used across Relay. Replaces every native <select>.
 * Built on Base UI Select, so it is keyboard accessible (type to jump, arrows, Enter, Esc)
 * and announced correctly by screen readers.
 */
export function OptionSelect<T extends string>({
  value,
  onValueChange,
  options,
  id,
  placeholder = "Select…",
  disabled,
  variant = "field",
  className,
  align = "start",
  ...rest
}: OptionSelectProps<T>) {
  const selected = options.find((option) => option.value === value);

  return (
    <SelectPrimitive.Root<T> value={value} onValueChange={(next) => next !== null && onValueChange(next)} items={options as SelectOption<T>[]} disabled={disabled}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={rest["aria-label"]}
        data-variant={variant}
        className={cn(
          "group/select flex w-full min-w-0 items-center justify-between gap-2 border bg-transparent text-sm whitespace-nowrap outline-none select-none",
          "transition-[border-color,background-color,box-shadow] duration-75",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "data-popup-open:border-ring data-popup-open:ring-3 data-popup-open:ring-ring/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          variant === "field" ? "h-9 rounded-[4px] border-input px-2.5 hover:border-ash" : "h-8 w-auto rounded-full border-stone bg-background px-3.5 hover:border-ash hover:bg-secondary",
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.icon}
          <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected ? selected.label : placeholder}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-100 group-data-popup-open/select:rotate-180" aria-hidden />
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner align={align} sideOffset={6} alignItemWithTrigger={false} className="isolate z-50">
          <SelectPrimitive.Popup
            className={cn(
              "max-h-[min(var(--available-height),20rem)] min-w-[max(var(--anchor-width),10rem)] origin-(--transform-origin) overflow-y-auto overflow-x-hidden rounded-[12px] border border-border bg-popover p-1.5 text-popover-foreground outline-none",
              "shadow-[0_0_1px_rgba(0,0,0,0.4),0_4px_16px_rgba(0,0,0,0.08)]",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-75",
            )}
          >
            <SelectPrimitive.List>
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-[8px] py-2 pr-2 pl-2.5 text-sm outline-none select-none",
                    "data-highlighted:bg-secondary data-selected:font-medium data-disabled:pointer-events-none data-disabled:opacity-50",
                  )}
                >
                  {option.icon}
                  <SelectPrimitive.ItemText className="flex-1 truncate">{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="grid size-4 place-items-center">
                    <Check className="size-4" aria-hidden />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
