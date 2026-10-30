"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, FileText, ImageIcon, Paperclip, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
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

function useAttachmentUrl(attachment: Attachment) {
  return useQuery({
    queryKey: ["attachment-url", attachment.id],
    queryFn: () => attachmentUrl(attachment),
    staleTime: 50 * 60_000, // signed links last an hour
  });
}

function Thumbnail({ attachment }: { attachment: Attachment }) {
  const { data: url, isPending } = useAttachmentUrl(attachment);
  if (isImage(attachment)) {
    if (isPending) return <Skeleton className="size-full rounded-none" />;
    if (url) {
      // eslint-disable-next-line @next/next/no-img-element -- signed storage URLs, sizes unknown
      return <img src={url} alt={attachment.file_name} loading="lazy" className="size-full object-cover" />;
    }
  }
  return (
    <span className="grid size-full place-items-center bg-secondary text-muted-foreground">
      {isImage(attachment) ? <ImageIcon className="size-5" aria-hidden /> : <FileText className="size-5" aria-hidden />}
    </span>
  );
}

function AttachmentCard({ attachment, canDelete, onDelete }: { attachment: Attachment; canDelete: boolean; onDelete: () => void }) {
  const { data: url } = useAttachmentUrl(attachment);
  const who = attachment.source === "client" ? "Client (Slack)" : attachment.uploader?.full_name || attachment.uploader?.email || attachment.uploaded_by_label || "Former member";
  return (
    <li className="group/file relative flex items-center gap-3 rounded-[12px] border border-border bg-background p-2 pr-3 transition-colors duration-75 hover:border-ash" data-testid="attachment">
      <a href={url ?? undefined} target="_blank" rel="noreferrer" className="size-12 shrink-0 overflow-hidden rounded-[8px] border border-border" aria-label={`Open ${attachment.file_name}`}>
        <Thumbnail attachment={attachment} />
      </a>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.file_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {who} · <time dateTime={attachment.created_at} title={formatDateTime(attachment.created_at)}>{formatRelative(attachment.created_at)}</time>
          {attachment.size_bytes ? ` · ${formatSize(attachment.size_bytes)}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-75 group-focus-within/file:opacity-100 group-hover/file:opacity-100">
        {url ? (
          <Tip label="Open">
            <a href={url} target="_blank" rel="noreferrer" aria-label={`Download ${attachment.file_name}`} className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <Download className="size-4" />
            </a>
          </Tip>
        ) : null}
        {canDelete ? (
          <Tip label="Remove">
            <button type="button" aria-label={`Remove ${attachment.file_name}`} onClick={onDelete} className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive">
              <Trash2 className="size-4" />
            </button>
          </Tip>
        ) : null}
      </div>
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
  const canUpload = can(user.role, "comments.create");
  const isAdmin = user.role === "super_admin" || user.role === "project_manager";

  const client = attachments?.filter((item) => item.source === "client") ?? [];
  const team = attachments?.filter((item) => item.source === "team") ?? [];

  function add(files: FileList | File[] | null) {
    const list = files ? [...files] : [];
    if (list.length && canUpload) upload.mutate({ files: list, userId: user.id });
  }

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
          <ul className="space-y-2">
            {client.map((item) => (
              <AttachmentCard key={item.id} attachment={item} canDelete={isAdmin} onDelete={() => remove.mutate(item.id)} />
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2" data-testid="team-attachments">
        <h4 className="flex items-center gap-1.5 text-sm font-medium">
          From the team <span className="text-xs font-normal text-muted-foreground tabular-nums">{team.length}</span>
        </h4>
        {isPending ? <Skeleton className="h-[66px] w-full rounded-[12px]" /> : null}
        {team.length > 0 ? (
          <ul className="space-y-2">
            {team.map((item) => (
              <AttachmentCard key={item.id} attachment={item} canDelete={item.uploaded_by === user.id || isAdmin} onDelete={() => remove.mutate(item.id)} />
            ))}
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
            <span>{upload.isPending ? "Uploading…" : "Drop files here, or"}</span>
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
