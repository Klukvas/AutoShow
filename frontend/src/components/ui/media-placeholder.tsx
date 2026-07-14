import { cn } from '@/lib/cn';

interface MediaPlaceholderProps {
  /** Optional VISIBLE corner caption (e.g. make name). Omit inside cards that
   *  already overlay their own title/price. */
  label?: string;
  /** Accessibility label for the image role (not rendered). */
  ariaLabel?: string;
  /** Brand wordmark rendered bottom-centre (handoff: "AUTOFLOW"). */
  wordmark?: string;
  className?: string;
}

/**
 * Intentional empty-media surface per the handoff: a 135° soft gradient with
 * a car-silhouette glyph and a letterspaced wordmark — a listing without
 * photos reads as deliberate, not as a broken image. Colours come from the
 * --ph-* tokens, so both themes are covered.
 */
export function MediaPlaceholder({ label, ariaLabel, wordmark, className }: MediaPlaceholderProps) {
  return (
    <div
      role="img"
      aria-label={ariaLabel ?? label}
      className={cn(
        'relative flex h-full w-full items-center justify-center overflow-hidden',
        'bg-gradient-to-br from-ph-a to-ph-b',
        className,
      )}
    >
      <CarGlyph className="w-[46%] max-w-[200px] text-ph-glyph" />
      {wordmark && (
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-[0.3em] text-ph-glyph">
          {wordmark}
        </span>
      )}
      {label && (
        <span className="absolute bottom-4 left-4 text-label font-semibold uppercase text-ink-3">
          {label}
        </span>
      )}
    </div>
  );
}

function CarGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 44" fill="currentColor" aria-hidden className={className}>
      {/* Filled silhouette — matches the handoff glyph better than an outline. */}
      <path d="M14 30c2-8 10-14 22-15l8-6c3-2 7-3 11-3h14c5 0 9 2 12 5l6 6 16 3c6 1 10 5 10 10v2c0 1-1 2-2 2h-8a9 9 0 0 0-18 0H44a9 9 0 0 0-18 0h-9c-2 0-3-1-3-3v-1z" />
      <circle cx="35" cy="34" r="6" />
      <circle cx="93" cy="34" r="6" />
    </svg>
  );
}
