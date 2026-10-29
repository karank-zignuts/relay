"use client";

import { ArrowUp, MessageSquareText, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/components/session-provider";
import { Textarea } from "@/components/ui/textarea";
import { can } from "@/lib/auth/roles";
import { formatDateTime, formatRelative, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAddComment, useComments, useDeleteComment } from "../queries";

export function TaskComments({ taskId }: { taskId: string }) {
  const user = useSession();
  const { data: comments, isLoading, isError } = useComments(taskId);
  const add = useAddComment(taskId);
  const remove = useDeleteComment(taskId);
  const [body, setBody] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll only the comment list. scrollIntoView would also scroll the whole drawer.
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [comments?.length]);

  function send() {
    if (!body.trim() || !can(user.role, "comments.create")) return;
    add.mutate({ authorId: user.id, body }, { onSuccess: () => setBody("") });
  }

  return (
    <section aria-label="Internal comments" className="space-y-3">
      <div>
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Team discussion</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Only your team sees these. Nothing is sent to Slack.</p>
      </div>

      <div ref={listRef} className="max-h-80 space-y-4 overflow-y-auto" data-testid="comments">
        {isLoading ? <p className="text-xs text-muted-foreground">Loading comments…</p> : null}
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
        {comments?.map((comment) => {
          const name = comment.author?.full_name || comment.author?.email || "Former member";
          const mine = comment.author_id === user.id;
          return (
            <div key={comment.id} className="group/comment flex gap-3 animate-pop" data-testid="comment">
              <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-medium", mine ? "bg-primary text-primary-foreground" : "bg-stone text-graphite")}>{initials(name)}</span>
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2 text-xs text-muted-foreground">
                  <span className="text-sm font-medium text-foreground">{mine ? "You" : name}</span>
                  <time dateTime={comment.created_at} title={formatDateTime(comment.created_at)}>
                    {formatRelative(comment.created_at)}
                  </time>
                  {mine || can(user.role, "tasks.delete") ? (
                    <button type="button" aria-label="Delete comment" className="ml-auto text-ash opacity-0 transition-[opacity,color] hover:text-foreground focus-visible:opacity-100 group-hover/comment:opacity-100" onClick={() => remove.mutate(comment.id)}>
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}
                </p>
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{comment.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative">
        <Textarea
          aria-label="Write a comment"
          placeholder="Write a comment…"
          value={body}
          rows={2}
          className="min-h-[72px] rounded-[12px] pr-14"
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              send();
            }
          }}
        />
        <button
          type="button"
          onClick={send}
          disabled={add.isPending || !body.trim()}
          aria-label="Send comment"
          className="absolute right-2.5 bottom-2.5 grid size-8 place-items-center rounded-full bg-primary text-primary-foreground transition-[background-color,opacity,transform] duration-150 hover:bg-graphite active:scale-95 disabled:opacity-30"
        >
          <ArrowUp className="size-4" />
        </button>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          <kbd className="font-mono">⌘</kbd> + <kbd className="font-mono">Enter</kbd> to send
        </p>
      </div>
    </section>
  );
}
