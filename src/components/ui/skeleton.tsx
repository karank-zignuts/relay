import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--secondary)_25%,var(--stone)_50%,var(--secondary)_75%)] bg-[length:200%_100%]", className)}
      {...props}
    />
  )
}

export { Skeleton }
