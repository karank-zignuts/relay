"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { History, X } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { OptionSelect } from "@/components/ui/option-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tip } from "@/components/ui/tip";
import { useTeam } from "@/features/tasks/queries";
import { parseIsoDate } from "@/lib/calendar";
import { formatDateTime, initials } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { useDebounced } from "@/lib/use-debounced";
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

type When = "any" | "hour" | "today" | "yesterday" | "week" | "month" | "custom";
const WHEN: { value: When; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "hour", label: "Last hour" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "Last 30 days" },
  { value: "custom", label: "Custom range…" },
];

/** Entries with no person behind them: syncs and Claude. */
const SYSTEM = "system";

type Custom = { fromDate: string; fromTime: string; toDate: string; toTime: string };
const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;

const atLocal = (date: string, time: string, fallback: string): Date | null => {
  const day = parseIsoDate(date);
  const match = TIME.exec(time.trim() || fallback);
  if (!day || !match) return null;
  day.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return day;
};

/** The window in the viewer's own time zone. Worked out when the query runs, so "Last hour" is always the last hour. */
function rangeFor(when: When, custom: Custom, now = new Date()): { from?: Date; to?: Date } {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ago = (ms: number) => new Date(now.getTime() - ms);
  switch (when) {
    case "hour":
      return { from: ago(3_600_000) };
    case "today":
      return { from: midnight };
    case "yesterday":
      return { from: new Date(midnight.getTime() - 86_400_000), to: midnight };
    case "week":
      return { from: ago(7 * 86_400_000) };
    case "month":
      return { from: ago(30 * 86_400_000) };
    case "custom": {
      const from = atLocal(custom.fromDate, custom.fromTime, "00:00");
      const to = atLocal(custom.toDate, custom.toTime, "23:59");
      return { from: from ?? undefined, to: to ? new Date(to.getTime() + 59_999) : undefined }; // the end minute is included
    }
    default:
      return {};
  }
}

function TimeField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  const invalid = value.trim() !== "" && !TIME.test(value.trim());
  return <Input aria-label={label} aria-invalid={invalid || undefined} inputMode="numeric" maxLength={5} placeholder={placeholder} className="w-[4.5rem] text-center font-mono tabular-nums" value={value} onChange={(event) => onChange(event.target.value)} />;
}

export function ActivityFeed() {
  const viewer = useSession();
  const { data: team = [] } = useTeam();
  const [group, setGroup] = useState(ALL);
  const [search, setSearch] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [when, setWhen] = useState<When>("any");
  const [custom, setCustom] = useState<Custom>({ fromDate: "", fromTime: "", toDate: "", toTime: "" });
  const needle = useDebounced(search.trim().replace(/["\\]/g, ""), 300);
  const setCustomField = (key: keyof Custom) => (value: string) => setCustom((previous) => ({ ...previous, [key]: value }));

  const query = useInfiniteQuery({
    queryKey: ["activity", { group, people, when, custom: when === "custom" ? custom : null, needle, test: viewer.isTest }],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      let request = createClient().from("activity_log").select("*").order("created_at", { ascending: false }).limit(PAGE);
      if (group !== ALL) request = request.like("action", `${group}%`);
      // Test data is never shown to anyone but the test accounts. The database enforces it; these filters keep it true for rows it has not flagged yet.
      if (!viewer.isTest) request = request.eq("is_test", false).not("actor_label", "ilike", "E2E %").not("summary", "ilike", "%relay-e2e+%").not("summary", "imatch", "E2E (super admin|project manager|developer|tester)");
      if (people.length) {
        const ids = people.filter((id) => id !== SYSTEM);
        request = request.or([ids.length ? `actor_id.in.(${ids.join(",")})` : "", people.includes(SYSTEM) ? "actor_id.is.null" : ""].filter(Boolean).join(","));
      }
      const { from, to } = rangeFor(when, custom);
      if (from) request = request.gte("created_at", from.toISOString());
      if (to) request = request.lte("created_at", to.toISOString());
      if (needle) request = request.or(`actor_label.ilike."%${needle}%",summary.ilike."%${needle}%"`);
      if (pageParam) request = request.lt("created_at", pageParam);
      const { data, error } = await request;
      if (error) throw new Error(error.message);
      return data;
    },
    getNextPageParam: (last) => (last.length === PAGE ? last[last.length - 1].created_at : undefined),
  });

  const entries = useMemo(() => query.data?.pages.flat() ?? [], [query.data]);
  const peopleOptions = useMemo(
    () => [{ value: SYSTEM, label: "Claude & system" }, ...team.map((member) => ({ value: member.id, label: member.full_name || member.email }))],
    [team],
  );
  const filtered = group !== ALL || people.length > 0 || when !== "any" || search.trim() !== "";
  const clear = () => {
    setGroup(ALL);
    setPeople([]);
    setWhen("any");
    setSearch("");
    setCustom({ fromDate: "", fromTime: "", toDate: "", toTime: "" });
  };

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
    <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-3 px-4 pt-4 pb-3 sm:px-6">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-2xl font-light leading-none tracking-[-0.02em]">Activity</h1>
        <p className="text-sm text-muted-foreground">Everything that happened in Relay, newest first.</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2" data-testid="activity-filters">
        <OptionSelect aria-label="Activity type" className="w-44" value={group} onValueChange={setGroup} options={GROUPS} />
        <MultiSelectFilter label="People" options={peopleOptions} selected={people} onChange={setPeople} />
        <OptionSelect aria-label="Time range" className="w-40" value={when} onValueChange={setWhen} options={WHEN} />
        {when === "custom" ? (
          <div className="flex flex-wrap items-center gap-1.5" data-testid="custom-range">
            <DatePicker aria-label="From date" placeholder="From date" className="w-36" value={custom.fromDate} onValueChange={setCustomField("fromDate")} />
            <TimeField label="From time" placeholder="00:00" value={custom.fromTime} onChange={setCustomField("fromTime")} />
            <span className="text-xs text-muted-foreground">to</span>
            <DatePicker aria-label="To date" placeholder="To date" className="w-36" value={custom.toDate} onValueChange={setCustomField("toDate")} />
            <TimeField label="To time" placeholder="23:59" value={custom.toTime} onChange={setCustomField("toTime")} />
          </div>
        ) : null}
        <Input aria-label="Search activity" placeholder="Search who or what…" className="w-56" value={search} onChange={(event) => setSearch(event.target.value)} />
        {filtered ? (
          <Button variant="ghost" size="sm" onClick={clear}>
            <X /> Clear filters
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]" data-testid="activity-scroll">
      {query.isPending ? (
        <div aria-busy="true" aria-label="Loading activity">
          <Skeleton className="mb-2 ml-1 h-3 w-20" />
          <ul className="divide-y divide-border overflow-hidden rounded-[20px] border border-border bg-background">
            {Array.from({ length: 8 }).map((_, index) => (
              <li key={index} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-7 shrink-0 rounded-full" />
                <Skeleton className={index % 2 ? "h-3.5 w-2/3" : "h-3.5 w-1/2"} />
                <Skeleton className="ml-auto h-3 w-10" />
              </li>
            ))}
          </ul>
        </div>
      ) : query.isError ? (
        <EmptyState icon={History} title="Could not load activity" role="alert" action={<Button variant="outline" onClick={() => query.refetch()}>Try again</Button>}>
          Check your connection and try again.
        </EmptyState>
      ) : entries.length === 0 ? (
        filtered ? (
          <EmptyState icon={History} title="Nothing matches these filters" action={<Button variant="outline" onClick={clear}>Clear filters</Button>}>
            Try a wider time range or fewer people.
          </EmptyState>
        ) : (
          <EmptyState icon={History} title="No activity yet">Task changes, comments, syncs and user changes will show up here.</EmptyState>
        )
      ) : (
        <div className="space-y-6" data-testid="activity-list">
          {days.map(([day, items]) => (
            <section key={day} aria-label={day}>
              {/* Sticks to the top while its day scrolls, so you always know which date you are reading. The next day's header takes over when it arrives. */}
              <h2 className="sticky top-0 z-10 bg-background px-1 pt-1 pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase" data-testid="activity-day">{day}</h2>
              <ul className="divide-y divide-border overflow-hidden rounded-[20px] border border-border bg-background">
                {items.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-secondary/60" data-testid="activity-row">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-stone text-[10px] font-medium text-graphite" aria-hidden>
                      {initials(entry.actor_label)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{entry.actor_label}</span> <span className="text-graphite">{entry.summary}</span>
                    </span>
                    <Tip label={formatDateTime(entry.created_at)}>
                      <time dateTime={entry.created_at} className="shrink-0 font-mono text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(entry.created_at))}
                      </time>
                    </Tip>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      </div>
      {query.hasNextPage ? (
        <div className="shrink-0 pt-1 text-center">
          <Button variant="outline" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
            {query.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
