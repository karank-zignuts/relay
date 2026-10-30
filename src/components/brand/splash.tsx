"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { RelayLoader } from "./relay-brand";

// The mark finishes assembling at about 2.1s and holds until 2.7s (brand/source/loader.css). Fade out once it has had its moment.
const PLAY_MS = 2600;
const REDUCED_MS = 600;
const FADE_MS = 300;

/**
 * Brand splash on every fresh page load, so the whole animation plays even when the app is ready sooner.
 * Server-rendered, so the first paint is the splash and not a flash of the page. Client-side navigation does not remount it.
 * Skipped for automated browsers so e2e tests are not held up.
 */
export function Splash() {
  const [phase, setPhase] = useState<"show" | "leave" | "gone">("show");

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // The animation started at first paint, which is before this effect runs. Only wait for what is left of it.
    const painted = performance.getEntriesByName("first-paint")[0]?.startTime ?? 0;
    const left = navigator.webdriver ? 0 : Math.max(300, (reduced ? REDUCED_MS : PLAY_MS) - (performance.now() - painted));
    const fade = navigator.webdriver ? 0 : FADE_MS;
    const leave = window.setTimeout(() => setPhase("leave"), left);
    const gone = window.setTimeout(() => setPhase("gone"), left + fade);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(gone);
    };
  }, []);

  if (phase === "gone") return null;
  return (
    <div
      data-testid="splash"
      role="status"
      aria-label="Loading Relay"
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity ease-out",
        phase === "leave" ? "pointer-events-none opacity-0" : "opacity-100",
      )}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <RelayLoader className="size-24" label="Loading Relay" />
      <noscript>
        <style>{"[data-testid=splash]{display:none}"}</style>
      </noscript>
    </div>
  );
}
