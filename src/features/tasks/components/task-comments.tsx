"use client";

import type { Editor } from "@tiptap/react";
import { Check, CheckCheck, MessageSquareText, Pencil, SendHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RichEditor } from "@/components/ui/rich-editor";
import { RichText, toSafeHtml } from "@/components/ui/rich-text";
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
  const draft = useRef<{ html: string; empty: boolean }>({ html: comment.body, empty: false });
  const pending = comment.id.startsWith("pending-");
  const name = comment.author?.full_name || comment.author?.email || "Former member";
  const mine = comment.author_id === user.id;

  function save() {
    const { html, empty } = draft.current;
    if (!empty && html !== comment.body) edit.mutate({ id: comment.id, body: html });
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
                      draft.current = { html: toSafeHtml(comment.body), empty: false };
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
          <RichEditor
            autoFocus
            ariaLabel="Edit comment"
            className="mt-1.5"
            initialHtml={toSafeHtml(comment.body)}
            onChange={(state) => (draft.current = state)}
            onSubmit={save}
            onCancel={() => setEditing(false)}
            actions={
              <>
                <Button size="xs" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button size="xs" onClick={save}>
                  Save
                </Button>
              </>
            }
          />
        ) : (
          <RichText body={comment.body} className="mt-1" />
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
  const [empty, setEmpty] = useState(true);
  const editorRef = useRef<Editor | null>(null);
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
    const editor = editorRef.current;
    if (!editor || editor.isEmpty || !can(user.role, "comments.create")) return;
    add.mutate({ authorId: user.id, body: editor.getHTML(), author: { id: user.id, full_name: user.fullName, email: user.email } });
    editor.commands.clearContent(true); // clear at once; the comment is already showing
    setEmpty(true);
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

      <RichEditor
        ariaLabel="Write a comment"
        placeholder="Write a comment…"
        onEditor={(editor) => (editorRef.current = editor)}
        onChange={({ empty: next }) => setEmpty(next)}
        onSubmit={send}
        actions={
          <Tip label="Send" shortcut="⌘↵">
            <button
              type="button"
              onClick={send}
              disabled={empty}
              aria-label="Send comment"
              className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground transition-[background-color,opacity,transform] duration-75 hover:bg-graphite active:scale-95 disabled:bg-stone disabled:text-ash"
            >
              <SendHorizontal className="size-4" />
            </button>
          </Tip>
        }
      />
    </section>
  );
}
