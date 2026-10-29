import { cn } from "@/lib/utils";

/** First-use and nothing-found states. A calm explanation plus one clear next step, never an illustration. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
  ...props
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
} & React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col items-center rounded-[20px] bg-secondary px-6 py-16 text-center animate-pop", className)} {...props}>
      <span className="mb-4 grid size-12 place-items-center rounded-full bg-background ring-1 ring-inset ring-border">
        <Icon className="size-5 text-graphite" />
      </span>
      <p className="text-lg font-light tracking-tight">{title}</p>
      {children ? <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{children}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
