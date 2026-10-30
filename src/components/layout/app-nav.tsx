"use client";

import { ChevronDown, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RelayLogo } from "@/components/brand/relay-brand";
import { Tip } from "@/components/ui/tip";
import { can, ROLE_LABELS, type Permission } from "@/lib/auth/roles";
import { useRealtimeStatus } from "@/lib/realtime";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; permission?: Permission }[] = [
  { href: "/tasks", label: "Tasks" },
  { href: "/attention", label: "Needs attention" },
  { href: "/activity", label: "Activity", permission: "activity.view" },
  { href: "/users", label: "Users", permission: "users.manage" },
  { href: "/settings", label: "Settings", permission: "settings.manage" },
];

export function AppNav({ attentionCount }: { attentionCount: number }) {
  const pathname = usePathname();
  const user = useSession();
  const live = useRealtimeStatus();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="flex h-[50px] items-center gap-6 px-4 sm:px-6">
        <Link href="/tasks" aria-label="Relay, go to tasks" className="transition-opacity hover:opacity-70">
          <RelayLogo className="h-[22px]" />
        </Link>
        <nav aria-label="Main" className="flex flex-1 items-center gap-1 self-stretch overflow-x-auto">
          {NAV.filter((item) => !item.permission || can(user.role, item.permission)).map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm transition-colors",
                  active ? "bg-secondary font-medium text-foreground after:absolute after:inset-x-3 after:-bottom-[11px] after:h-0.5 after:rounded-full after:bg-ember" : "text-graphite hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                {item.label}
                {item.href === "/attention" && attentionCount > 0 ? (
                  <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">{attentionCount}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <Tip label={live === "live" ? "Live: changes from your team appear instantly" : live === "offline" ? "Offline: reconnecting…" : "Connecting…"} side="bottom">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="live-status" data-status={live}>
            <span className={cn("size-1.5 rounded-full transition-colors duration-300", live === "live" ? "bg-foreground" : live === "offline" ? "bg-ember" : "animate-pulse bg-ash")} aria-hidden />
            <span className="hidden sm:inline">{live === "live" ? "Live" : live === "offline" ? "Offline" : "Connecting"}</span>
          </span>
        </Tip>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <UserRound /> {user.fullName || user.email} <ChevronDown />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {user.email}
              <br />
              {ROLE_LABELS[user.role]}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/account" />}>Account & password</DropdownMenuItem>
            <form action={signOut}>
              <DropdownMenuItem render={<button type="submit" className="w-full" />}>
                <LogOut /> Sign out
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
