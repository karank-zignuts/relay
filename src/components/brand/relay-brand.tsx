import { cn } from "@/lib/utils";
import { WORDMARK_PATH, WORDMARK_TRANSFORM } from "./wordmark";

// Relay's mark is three tiles and a diagonal leg that together read as an R. Ink follows `currentColor`, so it works on any surface; Ember is the brand accent.
// Geometry lives in brand/build-assets.mjs. Keep both in step.
const Tiles = () => (
  <>
    <rect className="rl-ember" width="40" height="40" rx="11" fill="var(--ember)" />
    <rect className="rl-ink-tr" x="48" width="40" height="40" rx="11" fill="currentColor" />
    <rect className="rl-ink-bl" y="48" width="40" height="40" rx="11" fill="currentColor" />
    <path className="rl-leg" d="M58 57L77 77" pathLength="100" stroke="var(--ember)" strokeWidth="20" strokeLinecap="round" fill="none" strokeDasharray="100 100" />
  </>
);

export function RelayMark({ className, title = "Relay" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 88 88" role="img" aria-label={title} className={cn("size-6 shrink-0", className)}>
      <Tiles />
    </svg>
  );
}

export function RelayLogo({ className, title = "Relay" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 318 90" role="img" aria-label={title} className={cn("h-7 w-auto shrink-0", className)}>
      <Tiles />
      <path transform={WORDMARK_TRANSFORM} d={WORDMARK_PATH} fill="currentColor" />
    </svg>
  );
}

/** The mark assembling itself: dot, stack, combine, final. Loops. Shows the finished mark when the user prefers reduced motion. */
export function RelayLoader({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <svg viewBox="-6 -6 100 100" role="img" aria-label={label} className={cn("size-16", className)}>
      <g className="rl-anim">
        <Tiles />
      </g>
    </svg>
  );
}
