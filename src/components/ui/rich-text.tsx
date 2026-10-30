"use client";

import { generateHTML, generateJSON } from "@tiptap/html";
import { useMemo } from "react";
import { richExtensions } from "@/components/ui/rich-editor";
import { cn } from "@/lib/utils";

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const looksLikeHtml = (body: string) => /^\s*<(p|ul|ol|blockquote|pre)[\s>]/i.test(body);

/**
 * Turns a stored comment into safe HTML. The text is parsed with the editor's own schema and written back out,
 * so anything the editor cannot produce (scripts, handlers, odd tags) is dropped. Comments written before the
 * rich editor existed are plain text and keep their line breaks.
 */
export function toSafeHtml(body: string): string {
  if (typeof window === "undefined" || !looksLikeHtml(body)) return `<p>${escapeHtml(body).replace(/\n/g, "<br>")}</p>`;
  return generateHTML(generateJSON(body, richExtensions), richExtensions);
}

export function RichText({ body, className }: { body: string; className?: string }) {
  const html = useMemo(() => toSafeHtml(body), [body]);
  return <div className={cn("rich-text text-sm leading-relaxed", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
