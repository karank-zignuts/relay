"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

type Status = "connecting" | "live" | "offline";

let status: Status = "connecting";
const listeners = new Set<() => void>();
const setStatus = (next: Status) => {
  if (status === next) return;
  status = next;
  listeners.forEach((listener) => listener());
};

/** Whether the live connection is up. Drives the dot in the header. */
export function useRealtimeStatus(): Status {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => status,
    () => "connecting" as Status,
  );
}

// Which query keys and server-rendered pages each table feeds.
const TABLES: Record<string, { keys: string[]; refresh?: boolean }> = {
  tasks: { keys: ["tasks", "tags", "modules"], refresh: true },
  task_assignees: { keys: ["tasks"] },
  task_comments: { keys: ["comments", "comment-reads", "tasks"] },
  comment_reads: { keys: ["comment-reads"] },
  task_attachments: { keys: ["attachments", "tasks"] },
  modules: { keys: ["modules"] },
  profiles: { keys: ["team"], refresh: true },
  activity_log: { keys: ["activity"] },
  sync_runs: { keys: ["sync-runs"] },
  api_keys: { keys: [], refresh: true },
  app_settings: { keys: ["settings"], refresh: true },
};

/**
 * One live connection for the whole app. Any change another person (or Claude's sync) makes shows up here
 * within a moment: the matching queries refetch, and server-rendered pages refresh.
 */
export function RealtimeSync() {
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    // Bursts (a sync touching 60 tasks) collapse into one refetch per key.
    const later = (id: string, delay: number, run: () => void) => {
      clearTimeout(timers.get(id));
      timers.set(id, setTimeout(run, delay));
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;
    // Connect on the next tick. In development React mounts, unmounts and mounts again straight away, and Supabase
    // shares change subscriptions between channels, so tearing one down right after opening it silences the next.
    const start = setTimeout(() => {
      let next = supabase.channel(`relay-live-${crypto.randomUUID()}`);
      for (const [table, target] of Object.entries(TABLES)) {
        next = next.on("postgres_changes", { event: "*", schema: "public", table }, () => {
          for (const key of target.keys) later(`q:${key}`, 120, () => void queryClient.invalidateQueries({ queryKey: [key] }));
          if (target.refresh) later("refresh", 900, () => router.refresh());
        });
      }
      next.subscribe((state) => {
        if (state === "SUBSCRIBED") {
          setStatus("live");
          void queryClient.invalidateQueries(); // catch up on anything missed while offline
        } else if (state === "CLOSED" || state === "CHANNEL_ERROR" || state === "TIMED_OUT") setStatus("offline");
      });
      channel = next;
    }, 0);

    return () => {
      clearTimeout(start);
      timers.forEach(clearTimeout);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [queryClient, router]);

  return null;
}
