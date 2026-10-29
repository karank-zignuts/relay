import * as React from "react";
import { cn } from "@/lib/utils";

// A styled native <select>: fully keyboard and screen-reader accessible, used in forms.
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-9 w-full min-w-0 rounded-[4px] border border-input bg-transparent px-2.5 text-sm outline-none transition-[border-color,box-shadow] duration-150 hover:border-ash focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
