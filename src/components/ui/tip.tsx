"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "@/lib/utils";

/**
 * The one tooltip used across Relay. Wrap any element: `<Tip label="Delete"><button/></Tip>`.
 * It appears after a short hover or on keyboard focus, and fades and scales in from the element.
 * Use it instead of the `title` attribute, which is slow, unstyled and invisible to touch and keyboard users.
 */
export function Tip({
  label,
  shortcut,
  side = "top",
  align = "center",
  disabled,
  children,
}: {
  label: React.ReactNode;
  shortcut?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  disabled?: boolean;
  children: React.ReactElement<Record<string, unknown>>;
}) {
  if (disabled || !label) return children;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} align={align} sideOffset={8} className="isolate z-[70]">
          <TooltipPrimitive.Popup
            className={cn(
              "pointer-events-none flex max-w-64 origin-(--transform-origin) items-center gap-2 rounded-[8px] bg-foreground px-2.5 py-1.5 text-xs leading-snug text-background",
              "shadow-[0_4px_16px_rgba(0,0,0,0.16)] transition-[opacity,transform] duration-100 ease-out",
              "data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0",
            )}
          >
            <span>{label}</span>
            {shortcut ? <kbd className="rounded-[4px] bg-background/20 px-1 font-mono text-[10px]">{shortcut}</kbd> : null}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function TipProvider({ children }: { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delay={350} closeDelay={0} timeout={300}>
      {children}
    </TooltipPrimitive.Provider>
  );
}
