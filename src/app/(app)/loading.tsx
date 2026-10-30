import { Skeleton } from "@/components/ui/skeleton";

// Shown the instant a page is chosen, while its data is fetched on the server.
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 pt-6 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-5 w-28 rounded-full" />
      </div>
      <Skeleton className="h-9 w-80 rounded-full" />
      <div className="space-y-px overflow-hidden rounded-[20px] border border-border">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-none" />
        ))}
      </div>
    </div>
  );
}
