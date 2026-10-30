"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRelative } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";

const KEY = ["sync-runs", "latest"] as const;

export function useLatestSyncRun() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("sync_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export function SyncStatusBar() {
  const { data: run, isLoading, isError } = useLatestSyncRun();
  const now = useNow();

  let Icon = RefreshCw;
  let text = "Never synced. Ask Claude to sync the client channel.";

  if (isLoading) {
    text = "Checking sync status…";
  } else if (isError) {
    Icon = AlertTriangle;
    text = "Could not load sync status.";
  } else if (run) {
    const finished = run.finished_at ?? run.started_at;
    const stale = now.getTime() - Date.parse(finished) > STALE_AFTER_MS;
    if (run.status === "running") {
      Icon = Loader2;
      text = "Sync in progress…";
    } else {
      Icon = run.status === "success" ? CheckCircle2 : AlertTriangle;
      const counts = `${run.created_count} new · ${run.updated_count} updated · ${run.failed_count} failed`;
      const label = run.status === "success" ? "Synced" : run.status === "partial" ? "Synced with errors" : "Sync failed";
      text = `${label} ${formatRelative(finished, now)} · ${counts}${stale ? " · data may be out of date" : ""}`;
    }
  }

  return (
    <div role="status" data-testid="sync-status" className="flex items-center gap-2 border-b border-border bg-secondary px-4 py-1.5 text-xs text-muted-foreground sm:px-6">
      <Icon className={cn("size-3.5", run?.status === "running" && "animate-spin")} aria-hidden />
      <span>{text}</span>
    </div>
  );
}
