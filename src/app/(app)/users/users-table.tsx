"use client";

import { MailPlus, MoreHorizontal, Pencil, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptionSelect } from "@/components/ui/option-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { assignableRoles, canManageRole, ROLE_LABELS, type UserRole } from "@/lib/auth/roles";
import { formatRelative, initials } from "@/lib/format";

export type ManagedUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  slackUserId: string | null;
  status: "active" | "invited" | "deactivated";
  lastSignInAt: string | null;
};

type ApiResult = { ok: true } | { ok: false; message: string };

async function call(url: string, method: string, body?: unknown): Promise<ApiResult> {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.ok) return { ok: true };
  const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  return { ok: false, message: payload?.error?.message ?? "Something went wrong." };
}

const STATUS_LABEL = { active: "Active", invited: "Invited", deactivated: "Deactivated" } as const;

export function UsersTable({ users, actorId, actorRole }: { users: ManagedUser[]; actorId: string; actorRole: UserRole }) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [deleting, setDeleting] = useState<ManagedUser | null>(null);

  async function run(promise: Promise<ApiResult>, success: string) {
    const result = await promise;
    if (result.ok) {
      toast.success(success);
      router.refresh();
    } else {
      toast.error(result.message);
    }
    return result.ok;
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 animate-page-in sm:px-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] leading-[1.13] font-light tracking-[-0.02em]">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">{users.length} people on the team</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <MailPlus /> Invite user
        </Button>
      </div>

      <div className="overflow-x-auto rounded-[20px] border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Slack ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const manageable = user.id !== actorId && canManageRole(actorRole, user.role);
              return (
                <TableRow key={user.id} data-testid="user-row">
                  <TableCell>
                    <span className="flex items-center gap-3">
                      <span className="grid size-8 place-items-center rounded-full bg-stone text-xs font-medium text-graphite">{initials(user.fullName || user.email)}</span>
                      <span className="font-medium">{user.fullName || "—"}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-graphite">{user.email}</TableCell>
                  <TableCell>{ROLE_LABELS[user.role]}</TableCell>
                  <TableCell className="font-mono text-xs">{user.slackUserId ?? "—"}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span className={`size-2 rounded-full ${user.status === "active" ? "bg-foreground" : user.status === "invited" ? "bg-transparent ring-[1.5px] ring-inset ring-muted-foreground" : "bg-ash"}`} aria-hidden />
                      {STATUS_LABEL[user.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.lastSignInAt ? formatRelative(user.lastSignInAt) : "—"}</TableCell>
                  <TableCell>
                    {manageable || user.id === actorId ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${user.email}`} />}>
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditing(user)}>
                            <Pencil /> Edit
                          </DropdownMenuItem>
                          {manageable && user.status === "invited" ? (
                            <DropdownMenuItem onClick={() => run(call(`/api/users/${user.id}/resend-invite`, "POST"), "Invitation sent")}>
                              <Send /> Resend invitation
                            </DropdownMenuItem>
                          ) : null}
                          {manageable ? (
                            <DropdownMenuItem onClick={() => setDeleting(user)}>
                              <Trash2 /> Delete
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <UserDialog
        key={`invite-${inviteOpen}`}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        actorId={actorId}
        actorRole={actorRole}
        onSubmit={(values) => run(call("/api/users", "POST", values), "Invitation sent")}
      />
      <UserDialog
        key={editing?.id ?? "edit"}
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        user={editing ?? undefined}
        actorId={actorId}
        actorRole={actorRole}
        onSubmit={(values) =>
          run(
            call(`/api/users/${editing?.id}`, "PATCH", {
              fullName: values.fullName,
              slackUserId: values.slackUserId,
              ...(editing?.id !== actorId && { role: values.role, isActive: values.isActive }),
            }),
            "User updated",
          )
        }
      />

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              They lose access immediately and are unassigned from tasks. Their past comments and activity stay on record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deleting && (await run(call(`/api/users/${deleting.id}`, "DELETE"), "User deleted"))) setDeleting(null);
              }}
            >
              Delete user
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type FormValues = { email: string; fullName: string; role: UserRole; slackUserId: string; isActive: boolean };

function UserDialog({
  open,
  onOpenChange,
  user,
  actorId,
  actorRole,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: ManagedUser;
  actorId: string;
  actorRole: UserRole;
  onSubmit: (values: FormValues) => Promise<boolean>;
}) {
  const roles = assignableRoles(actorRole);
  const [values, setValues] = useState<FormValues>({
    email: user?.email ?? "",
    fullName: user?.fullName ?? "",
    role: user?.role ?? roles[roles.length - 1],
    slackUserId: user?.slackUserId ?? "",
    isActive: user ? user.status !== "deactivated" : true,
  });
  const [pending, setPending] = useState(false);
  const isSelf = user?.id === actorId;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const ok = await onSubmit(values);
    setPending(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? "Edit user" : "Invite user"}</DialogTitle>
          <DialogDescription>
            {user ? user.email : "They will get an email with a link to set their password."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {user ? null : (
            <div className="space-y-1.5">
              <Label htmlFor="user-email">Email</Label>
              <Input id="user-email" type="email" required value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="user-name">Full name</Label>
            <Input id="user-name" required value={values.fullName} onChange={(event) => setValues({ ...values, fullName: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="user-role">Role</Label>
            <OptionSelect
              id="user-role"
              value={values.role}
              disabled={isSelf}
              onValueChange={(role) => setValues({ ...values, role })}
              options={(isSelf && user ? [user.role] : roles).map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="user-slack">Slack member ID (optional)</Label>
            <Input id="user-slack" placeholder="U01ABC23DEF" value={values.slackUserId} onChange={(event) => setValues({ ...values, slackUserId: event.target.value })} />
            <p className="text-xs text-muted-foreground">Used to auto-assign tasks when this person is mentioned in Slack.</p>
          </div>
          {user && !isSelf ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={values.isActive} onChange={(event) => setValues({ ...values, isActive: event.target.checked })} />
              Active (can sign in)
            </label>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : user ? "Save" : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
