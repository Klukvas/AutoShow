'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scroll-lock';
import { useOverlayPresence } from '@/lib/use-overlay-presence';
import { useFocusTrap, isTopFocusTrap } from '@/lib/use-focus-trap';

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
  const { present, onExitComplete } = useOverlayPresence(open);
  const trapRef = useFocusTrap<HTMLDivElement>(present);
  const reduce = useReducedMotion();

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)');
    const closeOnDesktop = () => {
      if (desktop.matches) onClose();
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, [onClose]);

  useEffect(() => {
    if (!present) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && isTopFocusTrap(trapRef.current))
        onClose();
    };
    document.addEventListener('keydown', onKey);
    lockBodyScroll();
    return () => {
      document.removeEventListener('keydown', onKey);
      unlockBodyScroll();
    };
  }, [present, onClose, trapRef]);

  const sheetHidden = reduce ? { opacity: 0 } : { opacity: 0, y: 28 };
  const sheetShown = reduce ? { opacity: 1 } : { opacity: 1, y: 0 };

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {open && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          data-lenis-prevent
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={onClose}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] dark:bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          />
          <motion.div
            ref={trapRef}
            className="material-panel absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-sheet shadow-none"
            initial={sheetHidden}
            animate={sheetShown}
            exit={sheetHidden}
            transition={
              reduce
                ? { duration: 0.14, ease: 'easeOut' }
                : {
                    y: { type: 'spring', bounce: 0, duration: 0.28 },
                    opacity: { duration: 0.18, ease: 'easeOut' },
                  }
            }
            style={{ willChange: 'transform, opacity' }}
          >
            <div className="flex justify-center pt-2.5" aria-hidden>
              <span className="h-1 w-10 rounded-pill bg-line-strong" />
            </div>
            <div className="flex items-center justify-between px-5 pb-3 pt-2">
              <h2 className="font-heading text-section font-medium text-ink">{title}</h2>
              <button
                type="button"
                onClick={onReset}
                className="focus-ring rounded-btn px-2 py-1 text-sub font-medium text-accent-hover dark:text-accent"
              >
                {resetLabel}
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain border-t border-line px-5 py-5">
              {children}
            </div>
            <div className="border-t border-line bg-surface px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
              <Button variant="primary" size="lg" className="w-full" onClick={onClose}>
                {applyLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
