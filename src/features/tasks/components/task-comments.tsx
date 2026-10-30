"use client";

import { Check, CheckCheck, MessageSquareText, Pencil, SendHorizontal, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tip } from "@/components/ui/tip";
import { can } from "@/lib/auth/roles";
import { formatDateTime, formatRelative, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAddComment, useCommentReads, useComments, useDeleteComment, useEditComment, useMarkCommentsRead, useTeam } from "../queries";
import type { Comment, CommentRead } from "../types";

/** "Seen by Navin and Karan", with exact times on hover. Only shown to the person who wrote the comment. */
function SeenBy({ reads, names }: { reads: CommentRead[]; names: Map<string, string> }) {
  if (reads.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Check className="size-3" aria-hidden /> Sent
      </span>
    );
  }
  const label = reads.map((read) => `${names.get(read.user_id) ?? "Someone"} · ${formatDateTime(read.read_at)}`).join("\n");
  const short = reads.map((read) => (names.get(read.user_id) ?? "Someone").split(" ")[0]);
  const text = short.length <= 2 ? short.join(" and ") : `${short.slice(0, 2).join(", ")} +${short.length - 2}`;
  return (
    <Tip label={<span className="whitespace-pre-line">{label}</span>} side="bottom" align="start">
      <span className="inline-flex cursor-default items-center gap-1 text-[11px] text-muted-foreground" data-testid="seen-by">
        <CheckCheck className="size-3 text-foreground" aria-hidden /> Seen by {text}
      </span>
    </Tip>
  );
}

function CommentItem({ comment, reads, names, taskId }: { comment: Comment; reads: CommentRead[]; names: Map<string, string>; taskId: string }) {
  const user = useSession();
  const edit = useEditComment(taskId);
  const remove = useDeleteComment(taskId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const pending = comment.id.startsWith("pending-");
  const name = comment.author?.full_name || comment.author?.email || "Former member";
  const mine = comment.author_id === user.id;

  function save() {
    const body = draft.trim();
    if (body && body !== comment.body) edit.mutate({ id: comment.id, body });
    setEditing(false);
  }

  return (
    <div className={cn("group/comment flex gap-3 animate-pop", pending && "opacity-60")} data-testid="comment">
      <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-medium", mine ? "bg-primary text-primary-foreground" : "bg-stone text-graphite")}>{initials(name)}</span>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2 text-xs text-muted-foreground">
          <span className="text-sm font-medium text-foreground">{mine ? "You" : name}</span>
          <Tip label={formatDateTime(comment.created_at)}>
            <time dateTime={comment.created_at}>{formatRelative(comment.created_at)}</time>
          </Tip>
          {comment.edited_at ? (
            <Tip label={`Edited ${formatDateTime(comment.edited_at)}`}>
              <span className="text-[11px]">· edited</span>
            </Tip>
          ) : null}
          {!pending && !editing ? (
            <span className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity duration-75 group-focus-within/comment:opacity-100 group-hover/comment:opacity-100">
              {mine ? (
                <Tip label="Edit">
                  <button
                    type="button"
                    aria-label="Edit comment"
                    className="grid size-6 place-items-center rounded-full text-ash transition-colors hover:bg-secondary hover:text-foreground"
                    onClick={() => {
                      setDraft(comment.body);
                      setEditing(true);
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </Tip>
              ) : null}
              {mine || can(user.role, "tasks.delete") ? (
                <Tip label="Delete">
                  <button type="button" aria-label="Delete comment" className="grid size-6 place-items-center rounded-full text-ash transition-colors hover:bg-secondary hover:text-destructive" onClick={() => remove.mutate(comment.id)}>
                    <Trash2 className="size-3.5" />
                  </button>
                </Tip>
              ) : null}
            </span>
          ) : null}
        </p>
        {editing ? (
          <div className="mt-1.5 space-y-2">
            <Textarea
              autoFocus
              aria-label="Edit comment"
              value={draft}
              rows={2}
              className="rounded-[12px]"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setEditing(false);
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  save();
                }
              }}
            />
            <div className="flex gap-1.5">
              <Button size="xs" onClick={save} disabled={!draft.trim()}>
                Save
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setEditing(false)}>
                <X /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{comment.body}</p>
        )}
        {mine && !pending && !editing ? <div className="mt-1"><SeenBy reads={reads} names={names} /></div> : null}
      </div>
    </div>
  );
}

export function TaskComments({ taskId }: { taskId: string }) {
  const user = useSession();
  const { data: comments, isPending, isError } = useComments(taskId);
  const { data: reads } = useCommentReads(taskId);
  const { data: team } = useTeam();
  const add = useAddComment(taskId);
  const markRead = useMarkCommentsRead(taskId);
  const [body, setBody] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const names = useMemo(() => new Map((team ?? []).map((member) => [member.id, member.full_name || member.email])), [team]);

  useEffect(() => {
    // Scroll only the comment list. scrollIntoView would also scroll the whole drawer.
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [comments?.length]);

  // Opening the task marks other people's comments as read, which is what "Seen by" shows them.
  const unread = useMemo(() => {
    if (!comments || !reads) return 0;
    const mine = new Set(reads.filter((read) => read.user_id === user.id).map((read) => read.comment_id));
    return comments.filter((comment) => comment.author_id !== user.id && !comment.id.startsWith("pending-") && !mine.has(comment.id)).length;
  }, [comments, reads, user.id]);
  const { mutate: sendRead, isPending: markingRead } = markRead;
  useEffect(() => {
    if (unread > 0 && !markingRead) sendRead();
  }, [unread, markingRead, sendRead]);

  function send() {
    if (!body.trim() || !can(user.role, "comments.create")) return;
    add.mutate({ authorId: user.id, body, author: { id: user.id, full_name: user.fullName, email: user.email } });
    setBody(""); // clear at once; the comment is already showing
  }

  const readsByComment = (id: string) => (reads ?? []).filter((read) => read.comment_id === id && read.user_id !== user.id);

  return (
    <section aria-label="Internal comments" className="space-y-3">
      <div>
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Team discussion</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Only your team sees these. Nothing is sent to Slack.</p>
      </div>

      <div ref={listRef} className="max-h-80 space-y-4 overflow-y-auto" data-testid="comments">
        {isPending ? (
          <div className="space-y-4" aria-busy="true" aria-label="Loading comments">
            {[0, 1].map((row) => (
              <div key={row} className="flex gap-3">
                <Skeleton className="size-7 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {isError ? (
          <p role="alert" className="text-xs text-destructive">
            Could not load comments.
          </p>
        ) : null}
        {comments?.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[12px] bg-secondary px-4 py-8 text-center text-sm text-muted-foreground">
            <MessageSquareText className="size-5 text-ash" aria-hidden />
            Start the conversation. Mention what you checked, or what blocks you.
          </div>
        ) : null}
        {comments?.map((comment) => <CommentItem key={comment.id} comment={comment} reads={readsByComment(comment.id)} names={names} taskId={taskId} />)}
      </div>

      <div className="rounded-[12px] border border-input bg-background transition-[border-color,box-shadow] duration-75 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
        <Textarea
          aria-label="Write a comment"
          placeholder="Write a comment…"
          value={body}
          rows={2}
          className="min-h-[64px] resize-none rounded-[12px] border-0 bg-transparent shadow-none ring-0 hover:border-0 focus-visible:border-0 focus-visible:ring-0"
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              send();
            }
          }}
        />
        <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
          <p className="text-[11px] text-muted-foreground">
            <kbd className="font-mono">⌘</kbd> <kbd className="font-mono">Enter</kbd> to send
          </p>
          <Button size="sm" onClick={send} disabled={!body.trim()} aria-label="Send comment">
            Send <SendHorizontal />
          </Button>
        </div>
      </div>
    </section>
  );
}
