import { AppNav } from "@/components/layout/app-nav";
import { SessionProvider } from "@/components/session-provider";
import { SyncStatusBar } from "@/features/sync/sync-status-bar";
import { isAwaitingReply } from "@/lib/attention";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const supabase = await createClient();
  const { data: threads } = await supabase
    .from("tasks")
    .select("last_client_message_at, last_team_reply_at, reply_dismissed_at")
    .neq("status", "done")
    .not("last_client_message_at", "is", null);
  const attentionCount = (threads ?? []).filter(isAwaitingReply).length;

  return (
    <SessionProvider user={user}>
      <div className="flex h-dvh flex-col">
        <AppNav attentionCount={attentionCount} />
        <SyncStatusBar />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
      </div>
    </SessionProvider>
  );
}
