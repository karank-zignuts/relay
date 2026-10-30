"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { cn } from "@/lib/utils";

type View = { left: number; width: number } | null;

const setScrollLeft = (element: HTMLElement, left: number) => {
  element.scrollLeft = left;
};

/**
 * Small overview in the corner of a wide board, like Jira's: a sliver per column and a window for what is on screen.
 * Click to jump, drag the window to scroll. Hidden when every column already fits.
 */
export function BoardMinimap({ scroller, controls, columns, className }: { scroller: RefObject<HTMLDivElement | null>; /** id of the element that scrolls, for aria-controls */ controls: string; columns: number; className?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const grab = useRef<number | null>(null); // where inside the window the pointer took hold, as a fraction of the track
  const [view, setView] = useState<View>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const measure = () => {
      if (element.scrollWidth <= element.clientWidth + 1) {
        setView(null);
        return;
      }
      setView({ left: element.scrollLeft / element.scrollWidth, width: element.clientWidth / element.scrollWidth });
    };
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    schedule();
    element.addEventListener("scroll", schedule, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("scroll", schedule);
      observer.disconnect();
    };
  }, [scroller, columns]);

  const ratioAt = (clientX: number) => {
    const rect = track.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  // Scroll so the window's centre sits at `centre` (a fraction of the track), keeping the grab point under the pointer.
  const scrollToCentre = (centre: number) => {
    const element = scroller.current;
    if (!element) return;
    setScrollLeft(element, centre * element.scrollWidth - element.clientWidth / 2);
  };

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!view) return;
    const ratio = ratioAt(event.clientX);
    const inside = ratio >= view.left && ratio <= view.left + view.width;
    grab.current = inside ? ratio - (view.left + view.width / 2) : 0;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    scrollToCentre(ratio - grab.current);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (grab.current === null) return;
    scrollToCentre(ratioAt(event.clientX) - grab.current);
  }

  function onPointerUp() {
    grab.current = null;
    setDragging(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const element = scroller.current;
    if (!element) return;
    const step = event.key === "ArrowLeft" ? -160 : event.key === "ArrowRight" ? 160 : 0;
    if (step) setScrollLeft(element, element.scrollLeft + step);
    else if (event.key === "Home") setScrollLeft(element, 0);
    else if (event.key === "End") setScrollLeft(element, element.scrollWidth);
    else return;
    event.preventDefault();
  }

  if (!view) return null;
  const max = 1 - view.width;
  return (
    <div className={cn("pointer-events-none absolute right-4 bottom-4 z-20 sm:right-6", className)}>
      <div
        ref={track}
        role="scrollbar"
        aria-label="Scroll the board sideways"
        aria-orientation="horizontal"
        aria-controls={controls}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={max > 0 ? Math.round((view.left / max) * 100) : 0}
        tabIndex={0}
        data-testid="board-minimap"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className={cn(
          "pointer-events-auto relative flex h-9 w-[136px] touch-none gap-[3px] rounded-[10px] border border-border bg-background p-1 shadow-[rgba(0,0,0,0.4)_0_0_1px,rgba(0,0,0,0.04)_0_1px_1px,rgba(0,0,0,0.04)_0_2px_4px] outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
          dragging ? "cursor-grabbing" : "cursor-pointer",
        )}
      >
        {Array.from({ length: columns }).map((_, index) => (
          <span key={index} className="min-w-0 flex-1 rounded-[3px] bg-stone" aria-hidden />
        ))}
        <span
          aria-hidden
          data-testid="board-minimap-window"
          className="absolute top-0.5 bottom-0.5 rounded-[6px] border-[1.5px] border-graphite bg-graphite/5"
          style={{ left: `calc(4px + (100% - 8px) * ${view.left})`, width: `calc((100% - 8px) * ${view.width})`, cursor: dragging ? "grabbing" : "grab" }}
        />
      </div>
    </div>
  );
}
