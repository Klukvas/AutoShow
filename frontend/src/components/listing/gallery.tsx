'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scroll-lock';
import { useFocusTrap } from '@/lib/use-focus-trap';
import { MediaPlaceholder } from '@/components/ui/media-placeholder';
import type { PublicMedia } from '@/lib/api/types';

interface GalleryProps {
  media: PublicMedia[];
  title: string;
  /** Mobile-only overlay back link (handoff 1g). */
  backHref?: string;
}

const VISIBLE_THUMBS = 5;
/** Above this count the mobile dot indicator would overflow — the counter carries it. */
const MAX_DOTS = 10;

/**
 * Detail-page gallery per handoff 1d/1g. Desktop: 430px framed photo with
 * round ‹/› buttons, "📷 i / n" counter, fullscreen lightbox and a thumbnail
 * strip (last tile collapses the tail into "+N"). Mobile: 250px swipe gallery
 * with dot indicator and an overlay back button. Keyboard: ←/→ navigate,
 * Esc closes fullscreen.
 */
export function Gallery({ media, title, backHref }: GalleryProps) {
  const t = useTranslations('listing');
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  // Only show images that actually have processed renditions — otherwise fall
  // through to the clean placeholder instead of a broken image.
  const ready = media.filter((m) => m.type === 'image' && (m.renditions?.length ?? 0) > 0);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const goTo = useCallback(
    (next: number) => {
      const safe = Math.max(0, Math.min(ready.length - 1, next));
      setIndex(safe);
      trackRef.current?.children[safe]?.scrollIntoView({
        behavior: 'instant' as ScrollBehavior,
        inline: 'start',
        block: 'nearest',
      });
    },
    [ready.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't hijack keys while the user is typing in a form field (e.g. the
      // lead form on the same page) or interacting with another control.
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'ArrowRight') goTo(index + 1);
      if (e.key === 'ArrowLeft') goTo(index - 1);
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, index]);

  // Keep the counter / thumbnail highlight in sync when the user swipes or
  // scrolls the track manually (not just via the arrow buttons).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const width = track.clientWidth || 1;
        const next = Math.round(track.scrollLeft / width);
        setIndex((cur) => (next !== cur ? Math.max(0, Math.min(ready.length - 1, next)) : cur));
      });
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      track.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [ready.length]);

  // Lock body scroll while the lightbox is open (ref-counted — shared with the
  // nav drawer / filter sheet) and trap focus inside the dialog; the trap also
  // restores focus to the trigger on close.
  const trapRef = useFocusTrap<HTMLDivElement>(fullscreen);
  useEffect(() => {
    if (!fullscreen) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [fullscreen]);

  if (ready.length === 0) {
    return (
      <div className="relative -mx-5 h-[250px] overflow-hidden md:mx-0 md:h-[430px] md:rounded-window">
        <MediaPlaceholder ariaLabel={title} wordmark="AUTOFLOW" />
        {backHref && <BackOverlay href={backHref} label={t('backToCatalog')} />}
      </div>
    );
  }

  const collapsedThumbs = ready.length > VISIBLE_THUMBS;
  const thumbs = collapsedThumbs ? ready.slice(0, VISIBLE_THUMBS - 1) : ready;
  // Guard against a stale index if the media array ever shrinks between renders.
  const lightboxMedia = ready[index] ?? ready[0];

  return (
    <div aria-roledescription="carousel" aria-label={title}>
      {/* Main frame */}
      <div className="relative -mx-5 md:mx-0">
        <div
          ref={trackRef}
          className="flex h-[250px] w-full snap-x snap-mandatory overflow-x-auto bg-ph-b [scrollbar-width:none] md:h-[430px] md:rounded-window"
        >
          {ready.map((m, i) => {
            const full =
              m.renditions.find((r) => r.variant === 'full' && r.format === 'jpeg') ??
              m.renditions[0];
            return (
              <div
                key={m.id}
                className="relative h-full w-full flex-shrink-0 snap-start"
                aria-roledescription="slide"
                aria-label={t('galleryCounter', { index: i + 1, total: ready.length })}
              >
                <Image
                  src={full?.url ?? m.originalUrl}
                  alt={m.alt ?? title}
                  fill
                  sizes="(min-width: 768px) 60vw, 100vw"
                  priority={i === 0}
                  className="object-cover"
                />
              </div>
            );
          })}
        </div>

        {backHref && <BackOverlay href={backHref} label={t('backToCatalog')} />}

        {/* Counter — top-right overlay */}
        <div className="pointer-events-none absolute right-3 top-3 rounded-btn bg-ink/60 px-2.5 py-1 text-sub font-medium text-white backdrop-blur-sm">
          <span aria-hidden>📷 </span>
          {index + 1} / {ready.length}
        </div>

        {/* Fullscreen — bottom-left */}
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          className="focus-ring absolute bottom-3 left-3 hidden items-center gap-1.5 rounded-btn bg-surface/90 px-3 py-1.5 text-sub font-medium text-ink backdrop-blur-sm transition-colors hover:bg-surface md:inline-flex"
        >
          <span aria-hidden>⤢</span>
          {t('galleryFullscreen')}
        </button>

        {/* Round prev/next — desktop */}
        {ready.length > 1 && (
          <>
            <ArrowButton
              dir="prev"
              label={t('galleryPrev')}
              disabled={index === 0}
              onClick={() => goTo(index - 1)}
            />
            <ArrowButton
              dir="next"
              label={t('galleryNext')}
              disabled={index === ready.length - 1}
              onClick={() => goTo(index + 1)}
            />
          </>
        )}

        {/* Dots — mobile (counter alone carries very large galleries) */}
        {ready.length > 1 && ready.length <= MAX_DOTS && (
          <div aria-hidden className="absolute bottom-3 left-3 flex items-center gap-1.5 md:hidden">
            {ready.map((m, i) => (
              <span
                key={m.id}
                className={cn(
                  'rounded-pill bg-white/90 transition-all',
                  i === index ? 'h-1.5 w-5' : 'h-1.5 w-1.5 opacity-60',
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnail strip — desktop */}
      {ready.length > 1 && (
        <div className="mt-3 hidden gap-2.5 overflow-x-auto md:flex">
          {thumbs.map((m, i) => {
            const thumb =
              m.renditions.find((r) => r.variant === 'thumb' && r.format === 'jpeg') ??
              m.renditions[0];
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={t('galleryGoTo', { index: i + 1 })}
                aria-current={i === index}
                className={cn(
                  'focus-ring relative h-16 w-[92px] flex-shrink-0 overflow-hidden rounded-btn border-2 transition-colors',
                  i === index ? 'border-accent' : 'border-transparent opacity-80 hover:opacity-100',
                )}
              >
                <Image
                  src={thumb?.url ?? m.originalUrl}
                  alt=""
                  fill
                  sizes="120px"
                  className="object-cover"
                />
              </button>
            );
          })}
          {collapsedThumbs && (
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="focus-ring flex h-16 w-[92px] flex-shrink-0 items-center justify-center rounded-btn bg-ph-a text-sub font-semibold text-ink-2 transition-colors hover:bg-ph-b"
            >
              +{ready.length - (VISIBLE_THUMBS - 1)}
            </button>
          )}
        </div>
      )}

      {/* Fullscreen lightbox */}
      {fullscreen && lightboxMedia && (
        <div
          ref={trapRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-[110] flex flex-col bg-black/95"
        >
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <span className="text-sub font-medium">
              <span aria-hidden>📷 </span>
              {index + 1} / {ready.length}
            </span>
            <button
              type="button"
              data-autofocus
              aria-label={t('galleryClose')}
              onClick={() => setFullscreen(false)}
              className="focus-ring flex h-11 w-11 items-center justify-center rounded-btn text-lg hover:bg-white/10"
            >
              ✕
            </button>
          </div>
          <div className="relative flex-1">
            <Image
              src={
                (
                  lightboxMedia.renditions.find(
                    (r) => r.variant === 'full' && r.format === 'jpeg',
                  ) ?? lightboxMedia.renditions[0]
                )?.url ?? lightboxMedia.originalUrl
              }
              alt={lightboxMedia.alt ?? title}
              fill
              sizes="100vw"
              className="object-contain"
            />
            {ready.length > 1 && (
              <>
                <ArrowButton
                  dir="prev"
                  label={t('galleryPrev')}
                  disabled={index === 0}
                  onClick={() => goTo(index - 1)}
                  lightbox
                />
                <ArrowButton
                  dir="next"
                  label={t('galleryNext')}
                  disabled={index === ready.length - 1}
                  onClick={() => goTo(index + 1)}
                  lightbox
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ArrowButton({
  dir,
  label,
  disabled,
  onClick,
  lightbox,
}: {
  dir: 'prev' | 'next';
  label: string;
  disabled: boolean;
  onClick: () => void;
  lightbox?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'focus-ring absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-pill text-lg transition-colors disabled:opacity-35',
        dir === 'prev' ? 'left-3' : 'right-3',
        lightbox
          ? 'flex bg-white/10 text-white hover:bg-white/20'
          : 'hidden bg-surface/90 text-ink shadow-card backdrop-blur-sm hover:bg-surface md:flex',
      )}
    >
      {dir === 'prev' ? '‹' : '›'}
    </button>
  );
}

function BackOverlay({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="focus-ring absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-input bg-surface/90 text-lg text-ink backdrop-blur-sm md:hidden"
    >
      ‹
    </Link>
  );
}
