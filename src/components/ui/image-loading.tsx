"use client";

import { ImageOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

type Cell = { id: string; x: number; y: number; blinkDelay: number; fadeDelay: number; opacity: number };
type Phase = "loading" | "filling" | "fading" | "done";

// A repeatable "random" in [0, 1): the same cell always gets the same value, so rendering stays pure.
const noise = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

/** Mean colour of one square of the picture. Falls back to null when the browser blocks reading pixels. */
function sample(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): string | null {
  try {
    const { data } = context.getImageData(Math.max(0, x), Math.max(0, y), Math.max(1, width), Math.max(1, height));
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let index = 0; index < data.length; index += 16) {
      r += data[index];
      g += data[index + 1];
      b += data[index + 2];
      count += 1;
    }
    return count ? `rgb(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)})` : null;
  } catch {
    return null;
  }
}

/**
 * Picture that loads as a field of blinking squares. When the file is ready each square takes on the colour of the
 * part of the picture beneath it, grows to close the gaps, then fades away to reveal the image.
 * Without a `src` it keeps blinking, which makes it the placeholder while a file is still uploading.
 */
export function ImageLoader({
  src,
  alt = "",
  aspect = 4 / 3,
  gridSize = 12,
  cellGap = 3,
  cellShape = "square",
  cellColor = "var(--ash)",
  blinkSpeed = 1400,
  transitionDuration = 500,
  fadeOutDuration = 500,
  loadingDelay = 450,
  onLoad,
  className,
}: {
  src?: string | null;
  alt?: string;
  /** Width divided by height. The picture is cropped to fit, never stretched. */
  aspect?: number;
  gridSize?: number;
  cellGap?: number;
  cellShape?: "circle" | "square";
  cellColor?: string;
  blinkSpeed?: number;
  transitionDuration?: number;
  fadeOutDuration?: number;
  /** Shortest time the blinking shows, so a cached image does not flash. */
  loadingDelay?: number;
  onLoad?: () => void;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [phase, setPhase] = useState<Phase>("loading");
  const [ready, setReady] = useState(false); // the file has downloaded
  const [waited, setWaited] = useState(loadingDelay <= 0);
  const [failed, setFailed] = useState(false);
  const [colors, setColors] = useState<Record<string, string | null>>({});
  const [showImage, setShowImage] = useState(false);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (loadingDelay <= 0) return;
    const timer = setTimeout(() => setWaited(true), loadingDelay);
    return () => clearTimeout(timer);
  }, [loadingDelay]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const step = gridSize + cellGap;
  const cells = useMemo<Cell[]>(() => {
    if (size.width === 0 || size.height === 0) return [];
    const columns = Math.ceil(size.width / step) + 1;
    const rows = Math.ceil(size.height / step) + 1;
    return Array.from({ length: columns * rows }, (_, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      return { id: `${row}-${column}`, x: column * step, y: row * step, blinkDelay: noise(index + 1) * blinkSpeed, fadeDelay: noise(index + 7919) * fadeOutDuration, opacity: noise(index + 31) * 0.6 + 0.4 };
    });
  }, [size.width, size.height, step, blinkSpeed, fadeOutDuration]);

  const reveal = useCallback(() => {
    const img = image.current;
    if (!img || cells.length === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const next: Record<string, string | null> = {};
    if (context) {
      context.drawImage(img, 0, 0);
      // The picture is cropped to cover the box, so map box pixels onto the visible part of the file.
      const scale = Math.max(size.width / img.naturalWidth, size.height / img.naturalHeight);
      const offsetX = (img.naturalWidth * scale - size.width) / 2;
      const offsetY = (img.naturalHeight * scale - size.height) / 2;
      for (const cell of cells) next[cell.id] = sample(context, Math.floor((cell.x + offsetX) / scale), Math.floor((cell.y + offsetY) / scale), Math.floor(gridSize / scale), Math.floor(gridSize / scale));
    }
    setColors(next);
    setPhase("filling");
    timers.current.push(
      setTimeout(() => {
        setShowImage(true);
        setPhase("fading");
      }, transitionDuration),
      setTimeout(() => setPhase("done"), transitionDuration + fadeOutDuration * 2),
    );
    onLoad?.();
  }, [cells, size.width, size.height, gridSize, transitionDuration, fadeOutDuration, onLoad]);

  useEffect(() => {
    if (!ready || !waited || phase !== "loading" || cells.length === 0) return;
    queueMicrotask(reveal);
  }, [ready, waited, phase, cells.length, reveal]);

  const cellStyle = (cell: Cell): CSSProperties => {
    const base: CSSProperties = { position: "absolute", left: cell.x, top: cell.y, width: gridSize, height: gridSize, willChange: "opacity, transform" };
    if (phase === "loading") return { ...base, backgroundColor: cellColor, opacity: cell.opacity, animation: `grid-blink ${blinkSpeed}ms ease-in-out ${cell.blinkDelay}ms infinite backwards` };
    const filled: CSSProperties = { ...base, left: cell.x - cellGap / 2, top: cell.y - cellGap / 2, width: step, height: step, backgroundColor: colors[cell.id] ?? cellColor };
    if (phase === "filling") return { ...filled, opacity: 1, transition: `all ${transitionDuration}ms ease` };
    return { ...filled, opacity: 0, transition: `opacity ${fadeOutDuration}ms ease ${cell.fadeDelay}ms` };
  };

  return (
    <div ref={box} className={cn("relative w-full overflow-hidden bg-secondary", className)} style={{ aspectRatio: aspect }} data-phase={phase}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage links of unknown size
        <img
          ref={image}
          src={src}
          alt={alt}
          crossOrigin="anonymous"
          onLoad={() => setReady(true)}
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover transition-opacity duration-300"
          style={{ opacity: showImage ? 1 : 0 }}
        />
      ) : null}
      {failed ? (
        <span className="absolute inset-0 grid place-items-center text-muted-foreground">
          <ImageOff className="size-5" aria-label="Could not load the picture" />
        </span>
      ) : phase !== "done" && cells.length > 0 ? (
        <div className="pointer-events-none absolute inset-0 z-10" aria-hidden>
          {cells.map((cell) => (
            <div key={cell.id} className={cellShape === "circle" ? "rounded-full" : "rounded-[2px]"} style={cellStyle(cell)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
