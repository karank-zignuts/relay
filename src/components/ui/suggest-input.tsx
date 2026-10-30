"use client";

import { Autocomplete } from "@base-ui/react/autocomplete";
import { cn } from "@/lib/utils";

/**
 * Free-text input with a themed suggestion list. Replaces <input list="…"><datalist>.
 * The person can pick a suggestion or type something new.
 */
export function SuggestInput({
  value,
  onValueChange,
  suggestions,
  id,
  placeholder,
  disabled,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  suggestions: readonly string[];
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Autocomplete.Root items={suggestions as string[]} value={value} onValueChange={onValueChange} disabled={disabled}>
      <Autocomplete.Input
        id={id}
        placeholder={placeholder}
        className={cn(
          "h-9 w-full min-w-0 rounded-[4px] border border-input bg-transparent px-2.5 text-sm outline-none",
          "transition-[border-color,box-shadow] duration-75 placeholder:text-muted-foreground hover:border-ash",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      />
      <Autocomplete.Portal>
        <Autocomplete.Positioner sideOffset={6} className="isolate z-50">
          <Autocomplete.Popup
            className={cn(
              "max-h-[min(var(--available-height),16rem)] w-(--anchor-width) origin-(--transform-origin) overflow-y-auto rounded-[12px] border border-border bg-popover p-1.5 outline-none",
              "shadow-[0_0_1px_rgba(0,0,0,0.4),0_4px_16px_rgba(0,0,0,0.08)] duration-75 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0",
              "empty:hidden",
            )}
          >
            <Autocomplete.List>
              {(item: string) => (
                <Autocomplete.Item key={item} value={item} className="flex cursor-default items-center rounded-[8px] px-2.5 py-2 text-sm outline-none select-none data-highlighted:bg-secondary">
                  {item}
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}
