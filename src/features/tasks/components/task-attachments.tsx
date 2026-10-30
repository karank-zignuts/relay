"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Paperclip, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { ImageLoader, LazyImage } from "@/components/ui/image-loading";
import { Skeleton } from "@/components/ui/skeleton";
import { Tip } from "@/components/ui/tip";
import { can } from "@/lib/auth/roles";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { attachmentUrl } from "../api";
import { useAttachments, useDeleteAttachment, useUploadAttachments } from "../queries";
import type { Attachment } from "../types";

const formatSize = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const isImage = (attachment: Attachment) => Boolean(attachment.mime_type?.startsWith("image/")) || /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(attachment.file_name);

function useAttachmentUrl(attachment: Attachment, enabled = true) {
  return useQuery({
    queryKey: ["attachment-url", attachment.id],
    queryFn: () => attachmentUrl(attachment),
    staleTime: 50 * 60_000, // signed links last an hour
    enabled,
  });
}

/** A file that is being uploaded. It renders through the same card as a saved file, so the tile never remounts when the upload finishes. */
type PendingUpload = { key: string; file: File; startedAt: string };

// Saved files and their uploads share one key (name, size and which copy of that file), which is what keeps the card mounted.
const uploadKey = (name: string, size: number | null, nth: number) => `${name}:${size ?? 0}:${nth}`;

function Actions({ attachment, url, canDelete, onDelete, overlay }: { attachment: Attachment; url: string | null | undefined; canDelete: boolean; onDelete: () => void; overlay?: boolean }) {
  const button = cn("grid size-8 place-items-center rounded-full transition-colors", overlay ? "bg-background/90 text-foreground shadow-sm hover:bg-background" : "text-muted-foreground hover:bg-secondary hover:text-foreground");
  return (
    <div className="flex items-center gap-1">
      {url ? (
        <Tip label="Open">
          <a href={url} target="_blank" rel="noreferrer" aria-label={`Download ${attachment.file_name}`} className={button}>
            <Download className="size-4" />
          </a>
        </Tip>
      ) : null}
      {canDelete ? (
        <Tip label="Remove">
          <button type="button" aria-label={`Remove ${attachment.file_name}`} onClick={onDelete} className={cn(button, "hover:text-destructive")}>
            <Trash2 className="size-4" />
          </button>
        </Tip>
      ) : null}
    </div>
  );
}

function Caption({ attachment, pending }: { attachment: Attachment; pending?: boolean }) {
  const who = attachment.source === "client" ? "Client (Slack)" : attachment.uploader?.full_name || attachment.uploader?.email || attachment.uploaded_by_label || "Former member";
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium">{attachment.file_name}</p>
      <p className="truncate text-xs text-muted-foreground">
        {pending ? "Uploading…" : <>{who} · <time dateTime={attachment.created_at} title={formatDateTime(attachment.created_at)}>{formatRelative(attachment.created_at)}</time></>}
        {attachment.size_bytes ? ` · ${formatSize(attachment.size_bytes)}` : ""}
      </p>
    </div>
  );
}

/** Pictures show as tiles: squares that reveal themselves for a fresh upload, a shimmer for saved ones. Other files are a plain row. */
function AttachmentCard({ attachment, canDelete, onDelete, pending = false, fresh = false }: { attachment: Attachment; canDelete: boolean; onDelete: () => void; pending?: boolean; fresh?: boolean }) {
  const { data: queried } = useAttachmentUrl(attachment, !pending);
  const url = pending ? undefined : queried;
  if (isImage(attachment)) {
    return (
      <li className="group/file overflow-hidden rounded-[12px] border border-border bg-background transition-colors duration-75 hover:border-ash" data-testid="attachment" data-pending={pending || undefined}>
        <div className="relative">
          <a href={url ?? undefined} target="_blank" rel="noreferrer" aria-label={pending ? `Uploading ${attachment.file_name}` : `Open ${attachment.file_name}`} className="block">
            {/* Squares for a file just uploaded (it keeps them through the reveal); a shimmer for one that was already saved. */}
            {pending || fresh ? <ImageLoader src={url} alt={attachment.file_name} aspect={4 / 3} gridSize={10} cellGap={3} /> : <LazyImage src={url} alt={attachment.file_name} aspect={4 / 3} />}
          </a>
          {pending ? null : (
            <div className="absolute top-2 right-2 z-20 opacity-0 transition-opacity duration-75 group-focus-within/file:opacity-100 group-hover/file:opacity-100">
              <Actions attachment={attachment} url={url} canDelete={canDelete} onDelete={onDelete} overlay />
            </div>
          )}
        </div>
        <div className="flex p-2.5">
          <Caption attachment={attachment} pending={pending} />
        </div>
      </li>
    );
  }
  return (
    <li className={cn("group/file relative flex items-center gap-3 rounded-[12px] border border-border bg-background p-2 pr-3 transition-[border-color,opacity] duration-75 hover:border-ash sm:col-span-2", pending && "opacity-60")} data-testid="attachment" data-pending={pending || undefined}>
      <a href={url ?? undefined} target="_blank" rel="noreferrer" className="grid size-12 shrink-0 place-items-center rounded-[8px] bg-secondary text-muted-foreground" aria-label={`Open ${attachment.file_name}`}>
        <FileText className="size-5" aria-hidden />
      </a>
      <Caption attachment={attachment} pending={pending} />
      {pending ? null : (
        <div className="opacity-0 transition-opacity duration-75 group-focus-within/file:opacity-100 group-hover/file:opacity-100">
          <Actions attachment={attachment} url={url} canDelete={canDelete} onDelete={onDelete} />
        </div>
      )}
    </li>
  );
}

/** Two clearly separate groups: what the client shared, and what the team added. */
export function TaskAttachments({ taskId }: { taskId: string }) {
  const user = useSession();
  const { data: attachments, isPending } = useAttachments(taskId);
  const upload = useUploadAttachments(taskId);
  const remove = useDeleteAttachment(taskId);
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  // Keys uploaded in this session. They keep the square reveal after the upload finishes; everything else lazy-loads with a shimmer.
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const canUpload = can(user.role, "comments.create");
  const isAdmin = user.role === "super_admin" || user.role === "project_manager";

  const client = attachments?.filter((item) => item.source === "client") ?? [];
  const savedTeam = attachments?.filter((item) => item.source === "team") ?? [];

  // Saved files and uploads in one list, each under a stable key. An upload keeps its card (and the blinking squares) until
  // the saved file with the same key shows up, and then that same card carries on into the reveal. Nothing unmounts in between.
  const seen = new Map<string, number>();
  const nextCopy = (name: string, size: number | null) => {
    const base = `${name}:${size ?? 0}`;
    const nth = seen.get(base) ?? 0;
    seen.set(base, nth + 1);
    return nth;
  };
  const saved = savedTeam.map((item) => ({ key: uploadKey(item.file_name, item.size_bytes, nextCopy(item.file_name, item.size_bytes)), item }));
  const savedKeys = new Set(saved.map((entry) => entry.key));
  const uploading = pending.filter((entry) => !savedKeys.has(entry.key));
  const teamCount = saved.length + uploading.length;

  function add(files: FileList | File[] | null) {
    const list = files ? [...files] : [];
    if (!list.length || !canUpload) return;
    const counts = new Map<string, number>();
    for (const entry of [...saved.map((s) => s.item), ...pending.map((p) => ({ file_name: p.file.name, size_bytes: p.file.size }))]) {
      const base = `${entry.file_name}:${entry.size_bytes ?? 0}`;
      counts.set(base, (counts.get(base) ?? 0) + 1);
    }
    const batch: PendingUpload[] = list.map((file) => {
      const base = `${file.name}:${file.size}`;
      const nth = counts.get(base) ?? 0;
      counts.set(base, nth + 1);
      return { key: uploadKey(file.name, file.size, nth), file, startedAt: new Date().toISOString() };
    });
    setPending((current) => [...current, ...batch]);
    setFresh((current) => new Set([...current, ...batch.map((entry) => entry.key)]));
    // Once settled the saved files are in the list. Drop whatever is left (uploads that failed).
    upload.mutate({ files: list, userId: user.id }, { onSettled: () => setPending((current) => current.filter((entry) => !batch.some((b) => b.key === entry.key))) });
  }

  const pendingAttachment = (entry: PendingUpload): Attachment => ({
    id: `pending-${entry.key}`,
    task_id: taskId,
    file_name: entry.file.name,
    mime_type: entry.file.type || null,
    size_bytes: entry.file.size,
    source: "team",
    storage_path: null,
    external_url: null,
    created_at: entry.startedAt,
    updated_at: entry.startedAt,
    deleted_at: null,
    uploaded_by: user.id,
    uploaded_by_label: null,
    uploader: { id: user.id, full_name: user.fullName, email: user.email },
  });

  return (
    <section aria-label="Attachments" className="space-y-4">
      <div>
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Attachments</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Files the client shared in Slack are kept separate from files your team adds.</p>
      </div>

      <div className="space-y-2" data-testid="client-attachments">
        <h4 className="flex items-center gap-1.5 text-sm font-medium">
          From the client <span className="text-xs font-normal text-muted-foreground tabular-nums">{client.length}</span>
        </h4>
        {isPending ? (
          <Skeleton className="h-[66px] w-full rounded-[12px]" />
        ) : client.length === 0 ? (
          <p className="rounded-[12px] bg-secondary px-3.5 py-3 text-xs text-muted-foreground">No client files on this thread. Claude adds them during the Slack sync.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {client.map((item) => (
              <AttachmentCard key={item.id} attachment={item} canDelete={isAdmin} onDelete={() => remove.mutate(item.id)} />
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2" data-testid="team-attachments">
        <h4 className="flex items-center gap-1.5 text-sm font-medium">
          From the team <span className="text-xs font-normal text-muted-foreground tabular-nums">{teamCount}</span>
        </h4>
        {isPending ? <Skeleton className="h-[66px] w-full rounded-[12px]" /> : null}
        {teamCount > 0 ? (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {/* One array, so a card keeps its place in the tree when an upload becomes the saved file. Two arrays would remount it. */}
            {[
              ...saved.map(({ key, item }) => <AttachmentCard key={key} attachment={item} canDelete={item.uploaded_by === user.id || isAdmin} onDelete={() => remove.mutate(item.id)} fresh={fresh.has(key)} />),
              ...uploading.map((entry) => <AttachmentCard key={entry.key} attachment={pendingAttachment(entry)} canDelete={false} onDelete={() => {}} pending />),
            ]}
          </ul>
        ) : null}
        {canUpload ? (
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              add(event.dataTransfer.files);
            }}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-[12px] border border-dashed px-4 py-5 text-center text-xs text-muted-foreground transition-colors duration-100",
              dragging ? "border-ember/70 bg-ember/5 text-foreground" : "border-ash/60",
            )}
          >
            <UploadCloud className="size-5 text-ash" aria-hidden />
            <span>Drop files here, or</span>
            <Button type="button" variant="outline" size="sm" disabled={upload.isPending} onClick={() => input.current?.click()}>
              <Paperclip /> Add files
            </Button>
            <input ref={input} type="file" multiple hidden data-testid="attachment-input" onChange={(event) => { add(event.target.files); event.target.value = ""; }} />
            <span>Up to 25 MB each. Your name is saved with the file.</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
