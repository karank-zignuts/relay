"use client";

import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Code, Italic, Link2, List, ListOrdered, Strikethrough } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tip } from "@/components/ui/tip";
import { cn } from "@/lib/utils";

/** The one set of formats comments support. Rendering uses the same list, so what you write is what is shown. */
export const richExtensions = [
  StarterKit.configure({
    heading: false,
    horizontalRule: false,
    codeBlock: false,
    link: { openOnClick: false, autolink: true, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer nofollow" } },
  }),
];

function ToolButton({ label, shortcut, active, onClick, children }: { label: string; shortcut?: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tip label={label} shortcut={shortcut}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        // Keep the caret in the editor: a button press must not steal focus.
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
        className={cn("grid size-7 place-items-center rounded-full text-muted-foreground transition-colors duration-75 hover:bg-stone hover:text-foreground", active && "bg-stone text-foreground")}
      >
        {children}
      </button>
    </Tip>
  );
}

function LinkButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setUrl((editor.getAttributes("link").href as string | undefined) ?? "");
      }}
    >
      <Tip label="Link" shortcut="⌘K">
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label="Link"
              aria-pressed={editor.isActive("link")}
              onMouseDown={(event) => event.preventDefault()}
              className={cn("grid size-7 place-items-center rounded-full text-muted-foreground transition-colors duration-75 hover:bg-stone hover:text-foreground", editor.isActive("link") && "bg-stone text-foreground")}
            />
          }
        >
          <Link2 className="size-3.5" />
        </PopoverTrigger>
      </Tip>
      <PopoverContent align="start" side="top" className="w-72 gap-2 p-2">
        <form
          className="flex items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            const href = url.trim();
            if (!href) editor.chain().focus().extendMarkRange("link").unsetLink().run();
            else editor.chain().focus().extendMarkRange("link").setLink({ href: /^[a-z]+:/i.test(href) ? href : `https://${href}` }).run();
            setOpen(false);
          }}
        >
          <input
            autoFocus
            aria-label="Link address"
            placeholder="Paste a link"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="h-8 min-w-0 flex-1 rounded-[8px] bg-secondary px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
          />
          <button type="submit" className="h-8 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-graphite">
            Apply
          </button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Rich text field for comments, built on Tiptap. A soft filled surface with the formatting tools and a slot for the
 * send button inside it, so the text sits above them like in a chat box. Stores HTML.
 */
export function RichEditor({
  initialHtml = "",
  placeholder,
  ariaLabel,
  autoFocus,
  onChange,
  onSubmit,
  onCancel,
  onEditor,
  actions,
  className,
}: {
  initialHtml?: string;
  placeholder?: string;
  ariaLabel: string;
  autoFocus?: boolean;
  onChange?: (state: { html: string; empty: boolean }) => void;
  /** Called on ⌘/Ctrl + Enter. */
  onSubmit?: () => void;
  onCancel?: () => void;
  onEditor?: (editor: Editor) => void;
  /** Rendered at the bottom right, inside the field. */
  actions?: React.ReactNode;
  className?: string;
}) {
  const submit = useRef(onSubmit);
  const cancel = useRef(onCancel);
  useEffect(() => {
    submit.current = onSubmit;
    cancel.current = onCancel;
  });

  const editor = useEditor({
    extensions: [...richExtensions, Placeholder.configure({ placeholder: placeholder ?? "" })],
    content: initialHtml,
    autofocus: autoFocus ? "end" : false,
    immediatelyRender: false,
    editorProps: {
      attributes: { "aria-label": ariaLabel, "aria-multiline": "true", role: "textbox", class: "rich-text min-h-[44px] px-4 pt-3.5 pb-1 text-sm leading-relaxed outline-none" },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          submit.current?.();
          return true;
        }
        if (event.key === "Escape" && cancel.current) {
          cancel.current();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: current }) => onChange?.({ html: current.getHTML(), empty: current.isEmpty }),
    onCreate: ({ editor: current }) => onEditor?.(current),
  });

  return (
    <div className={cn("rounded-[20px] bg-secondary transition-shadow duration-100 focus-within:ring-3 focus-within:ring-ring/20", className)}>
      <div className="max-h-52 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
      <div className="flex items-center gap-0.5 px-2.5 pt-1 pb-2.5">
        {editor ? (
          <>
            <ToolButton label="Bold" shortcut="⌘B" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
              <Bold className="size-3.5" />
            </ToolButton>
            <ToolButton label="Italic" shortcut="⌘I" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <Italic className="size-3.5" />
            </ToolButton>
            <ToolButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
              <Strikethrough className="size-3.5" />
            </ToolButton>
            <ToolButton label="Code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
              <Code className="size-3.5" />
            </ToolButton>
            <span className="mx-1 h-4 w-px bg-stone" aria-hidden />
            <ToolButton label="Bulleted list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
              <List className="size-3.5" />
            </ToolButton>
            <ToolButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
              <ListOrdered className="size-3.5" />
            </ToolButton>
            <LinkButton editor={editor} />
          </>
        ) : null}
        <div className="ml-auto flex items-center gap-1.5">{actions}</div>
      </div>
    </div>
  );
}
