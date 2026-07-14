/* eslint-disable @next/next/no-img-element -- tiny admin thumbnails straight
   from object storage; next/image optimization buys nothing at 50px wide. */
import { cn } from '@/lib/cn';

/**
 * Compact media preview for table rows / cards / media tiles. Renders the
 * photo when a URL is available; otherwise the handoff placeholder (135°
 * gradient + car silhouette) so a listing without photos reads as deliberate,
 * not as a broken image.
 */
export function CarThumb({
  className,
  label,
  src,
}: {
  className?: string;
  label?: string;
  src?: string | null;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={label ?? ''}
        draggable={false}
        className={cn('flex-none object-cover', className)}
      />
    );
  }
  return (
    <div
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        'flex flex-none items-center justify-center overflow-hidden bg-gradient-to-br from-ph-a to-ph-b',
        className,
      )}
    >
      <svg viewBox="0 0 160 64" fill="none" aria-hidden className="w-[64%] text-ph-glyph">
        <path
          d="M6 46C6 42 9 39 14 38L40 27C50 23 60 21 78 21L98 22C112 23 122 27 132 34L150 39C155 40 156 43 156 46L156 49L6 49Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}
