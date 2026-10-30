import { Skeleton } from "@/components/ui/skeleton";
import { TaskTableSkeleton } from "@/features/tasks/components/task-table";

/**
 * Loading states that copy the page they stand in for (same width, header, rows), so the page does not shift
 * when the data arrives. One per page layout; every route's loading.tsx uses its own.
 */

/** Page title (32px) and optional subtitle, as on Activity, Needs attention, Users, Settings and Account. */
function PageTitle({ subtitle = true, action }: { subtitle?: boolean; action?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        {subtitle ? <Skeleton className="h-3.5 w-72 max-w-full" /> : null}
      </div>
      {action ? <Skeleton className="h-9 w-32 rounded-full" /> : null}
    </div>
  );
}

export function WorkspaceSkeleton() {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1680px] flex-1 flex-col gap-3 px-4 pt-4 pb-3 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className="flex shrink-0 items-center gap-3">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-4 w-32" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-36 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Skeleton className="h-9 w-80 rounded-full" />
        {[14, 22, 16, 14, 18].map((width, index) => (
          <Skeleton key={index} className="h-8 rounded-full" style={{ width: width * 4 }} />
        ))}
      </div>
      <TaskTableSkeleton />
    </div>
  );
}

export function ActivitySkeleton() {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-3 px-4 pt-4 pb-3 sm:px-6" aria-busy="true" aria-label="Loading activity">
      <div className="flex shrink-0 items-center gap-3">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex shrink-0 gap-2">
        <Skeleton className="h-9 w-52 rounded-[4px]" />
        <Skeleton className="h-9 w-64 rounded-[4px]" />
      </div>
      <div>
        <Skeleton className="mb-2 ml-1 h-3 w-20" />
        <ul className="divide-y divide-border overflow-hidden rounded-[20px] border border-border bg-background">
          {Array.from({ length: 9 }).map((_, index) => (
            <li key={index} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <Skeleton className={index % 2 ? "h-3.5 w-2/3" : "h-3.5 w-1/2"} />
              <Skeleton className="ml-auto h-3 w-10" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function AttentionSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-8" aria-busy="true" aria-label="Loading">
      <PageTitle />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>
      <AttentionRowsSkeleton />
    </div>
  );
}

export function UsersSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-8" aria-busy="true" aria-label="Loading users">
      <PageTitle action />
      <div className="overflow-hidden rounded-[20px] border border-border bg-background">
        <div className="flex gap-6 border-b border-border px-4 py-3">
          {[24, 36, 16, 20, 16, 20].map((width, index) => (
            <Skeleton key={index} className="h-3" style={{ width: width * 4 }} />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-6 border-b border-border/70 px-4 py-3 last:border-0">
            <span className="flex w-24 items-center gap-3 sm:w-36">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <Skeleton className="h-3.5 w-20" />
            </span>
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 px-4 py-8 sm:px-8" aria-busy="true" aria-label="Loading settings">
      <PageTitle subtitle={false} />
      <div className="space-y-5 rounded-[20px] bg-secondary p-8">
        <div className="space-y-2">
          <Skeleton className="h-5 w-36 bg-stone" />
          <Skeleton className="h-3.5 w-3/4 bg-stone" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3.5 w-40 bg-stone" />
              <Skeleton className="h-9 w-full rounded-[4px] bg-stone" />
            </div>
          ))}
        </div>
        <Skeleton className="h-9 w-32 rounded-full bg-stone" />
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
        <ul className="divide-y divide-border rounded-[20px] border border-border">
          {Array.from({ length: 3 }).map((_, index) => (
            <li key={index} className="flex items-center gap-3 p-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
              <Skeleton className="h-8 w-20 rounded-full" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function AccountSkeleton() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-8 px-4 py-10" aria-busy="true" aria-label="Loading account">
      <PageTitle />
      <div className="space-y-4 rounded-[20px] bg-secondary p-8">
        <Skeleton className="h-5 w-36 bg-stone" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3.5 w-32 bg-stone" />
            <Skeleton className="h-9 w-full rounded-[4px] bg-stone" />
          </div>
        ))}
        <Skeleton className="h-9 w-40 rounded-full bg-stone" />
      </div>
    </div>
  );
}

/** The list of waiting threads, shared by the route loader and the in-page loading state. */
export function AttentionRowsSkeleton() {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-[20px] border border-border bg-background">
        {Array.from({ length: 4 }).map((_, index) => (
          <li key={index} className="flex items-center gap-5 p-5">
            <div className="w-24 shrink-0 space-y-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className={index % 2 ? "h-4 w-1/2" : "h-4 w-2/3"} />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-8 w-32 rounded-full" />
            <Skeleton className="h-8 w-36 rounded-full" />
          </li>
        ))}
    </ul>
  );
}
