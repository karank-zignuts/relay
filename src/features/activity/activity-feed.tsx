"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OptionSelect } from "@/components/ui/option-select";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/empty-state";
import { formatDateTime, initials } from "@/lib/format";
import { useNow } from "@/lib/use-now";

const PAGE = 50;

const ALL = "all";
const GROUPS = [
  { value: ALL, label: "All activity" },
  { value: "task.", label: "Tasks" },
  { value: "comment.", label: "Comments" },
  { value: "user.", label: "User management" },
  { value: "auth.", label: "Sign-ins" },
  { value: "sync.", label: "Syncs" },
  { value: "api_key.", label: "API keys" },
];

export function ActivityFeed() {
  const [group, setGroup] = useState(ALL);
  const [search, setSearch] = useState("");

  const query = useInfiniteQuery({
    queryKey: ["activity", group],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      let request = createClient().from("activity_log").select("*").order("created_at", { ascending: false }).limit(PAGE);
      if (group !== ALL) request = request.like("action", `${group}%`);
      if (pageParam) request = request.lt("created_at", pageParam);
      const { data, error } = await request;
      if (error) throw new Error(error.message);
      return data;
    },
    getNextPageParam: (last) => (last.length === PAGE ? last[last.length - 1].created_at : undefined),
  });

  const entries = useMemo(() => {
    const all = query.data?.pages.flat() ?? [];
    const needle = search.trim().toLowerCase();
    return needle ? all.filter((entry) => `${entry.actor_label} ${entry.summary}`.toLowerCase().includes(needle)) : all;
  }, [query.data, search]);

  const now = useNow(5 * 60_000);
  const days = useMemo(() => {
    const today = now.toDateString();
    const yesterday = new Date(now.getTime() - 86_400_000).toDateString();
    const groups = new Map<string, typeof entries>();
    for (const entry of entries) {
      const date = new Date(entry.created_at);
      const label = date.toDateString() === today ? "Today" : date.toDateString() === yesterday ? "Yesterday" : new Intl.DateTimeFormat("en-GB", { dateStyle: "full" }).format(date);
      groups.set(label, [...(groups.get(label) ?? []), entry]);
    }
    return [...groups.entries()];
  }, [entries, now]);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-3 px-4 pt-4 pb-3 animate-page-in sm:px-6">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-2xl font-light leading-none tracking-[-0.02em]">Activity</h1>
        <p className="text-sm text-muted-foreground">Everything that happened in Relay, newest first.</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <OptionSelect aria-label="Activity type" className="w-52" value={group} onValueChange={setGroup} options={GROUPS} />
        <Input aria-label="Search activity" placeholder="Search who or what…" className="w-64" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1" data-testid="activity-scroll">
      {query.isLoading ? (
        <div className="space-y-px overflow-hidden rounded-[20px] border border-border" aria-busy="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-none" />
          ))}
        </div>
      ) : query.isError ? (
        <EmptyState icon={History} title="Could not load activity" role="alert" action={<Button variant="outline" onClick={() => query.refetch()}>Try again</Button>}>
          Check your connection and try again.
        </EmptyState>
      ) : entries.length === 0 ? (
        <EmptyState icon={History} title="No activity yet">Task changes, comments, syncs and user changes will show up here.</EmptyState>
      ) : (
        <div className="space-y-6" data-testid="activity-list">
          {days.map(([day, items]) => (
            <section key={day} aria-label={day}>
              <h2 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{day}</h2>
              <ul className="divide-y divide-border overflow-hidden rounded-[20px] border border-border bg-background">
                {items.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-secondary/60" data-testid="activity-row">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-stone text-[10px] font-medium text-graphite" aria-hidden>
                      {initials(entry.actor_label)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{entry.actor_label}</span> <span className="text-graphite">{entry.summary}</span>
                    </span>
                    <time dateTime={entry.created_at} title={formatDateTime(entry.created_at)} className="shrink-0 font-mono text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(entry.created_at))}
                    </time>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {query.hasNextPage ? (
        <div className="py-4 text-center">
          <Button variant="outline" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
            {query.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
      </div>
    </div>
  );
}
