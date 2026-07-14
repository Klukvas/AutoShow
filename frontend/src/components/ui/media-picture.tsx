import Image from 'next/image';
import { cn } from '@/lib/cn';
import { MediaPlaceholder } from '@/components/ui/media-placeholder';
import type { PublicMedia, MediaRendition } from '@/lib/api/types';

interface MediaPictureProps {
  media: PublicMedia;
  alt?: string;
  sizes?: string;
  priority?: boolean;
  fill?: boolean;
  className?: string;
}

const VARIANT_ORDER: Record<string, number> = { thumb: 0, gallery: 1, full: 2 };

/**
 * Renders the backend-generated renditions as a responsive Image. We pick the
 * largest 'full' variant as the src (so Next still does its own optimization)
 * and rely on `sizes` for proper srcset selection. AVIF/WebP/JPEG variants are
 * advertised via custom <source> when fill mode is used in a <picture>.
 */
export function MediaPicture({
  media,
  alt,
  sizes = '100vw',
  priority,
  fill,
  className,
}: MediaPictureProps) {
  const ready = (media.renditions ?? []).slice().sort((a, b) => {
    const va = VARIANT_ORDER[a.variant] ?? 3;
    const vb = VARIANT_ORDER[b.variant] ?? 3;
    if (va !== vb) return va - vb;
    return a.width - b.width;
  });

  const fullWebp = pick(ready, 'full', 'webp');
  const fullJpeg = pick(ready, 'full', 'jpeg');
  const fallback = fullJpeg ?? fullWebp ?? ready[0] ?? null;
  const altText = alt ?? media.alt ?? '';

  // A ready image always has processed renditions; if there are none (e.g. a
  // rendition job never ran) show a clean neutral surface rather than the
  // browser's broken-image glyph or an unoptimized full-size original.
  if (!fallback) {
    return (
      <MediaPlaceholder
        ariaLabel={altText || undefined}
        className={cn(fill ? 'h-full w-full' : 'aspect-[16/9] w-full', className)}
      />
    );
  }

  const src = fallback.url;
  const width = fallback.width;
  const height = fallback.height;

  if (fill) {
    return (
      <Image
        src={src}
        alt={altText}
        fill
        sizes={sizes}
        priority={priority}
        className={cn('object-cover', className)}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={altText}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      className={className}
    />
  );
}

function pick(
  list: MediaRendition[],
  variant: MediaRendition['variant'],
  format: MediaRendition['format'],
): MediaRendition | undefined {
  return list.find((r) => r.variant === variant && r.format === format);
}
