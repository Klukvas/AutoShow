'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scroll-lock';
import { useFocusTrap } from '@/lib/use-focus-trap';

/**
 * Mobile filter sheet per handoff 1b: dimmed backdrop, bottom sheet with a
 * 22px top radius and drag handle, scrollable body, STICKY accent apply
 * button. Escape and backdrop click close it; body scroll is locked while
 * open.
 */
export function FilterSheet({
  open,
  title,
  resetLabel,
  applyLabel,
  onClose,
  onReset,
  children,
}: {
  open: boolean;
  title: string;
  resetLabel: string;
  applyLabel: string;
  onClose: () => void;
  onReset: () => void;
  children: React.ReactNode;
}) {
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    lockBodyScroll();
    return () => {
      document.removeEventListener('keydown', onKey);
      unlockBodyScroll();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] dark:bg-black/60"
      />
      <div
        ref={trapRef}
        className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-sheet bg-surface shadow-cta-sticky"
      >
        <div className="flex justify-center pt-2.5" aria-hidden>
          <span className="h-1 w-10 rounded-pill bg-line-strong" />
        </div>
        <div className="flex items-center justify-between px-5 pb-3 pt-2">
          <h2 className="font-heading text-section font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onReset}
            className="focus-ring rounded-btn px-2 py-1 text-sub font-semibold text-accent-hover dark:text-accent"
          >
            {resetLabel}
          </button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto border-t border-line px-5 py-5">
          {children}
        </div>
        <div className="border-t border-line bg-surface px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <Button variant="primary" size="lg" className="w-full" onClick={onClose}>
            {applyLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
