'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  type PanInfo,
} from 'framer-motion';
import { Button } from '@/components/ui/button';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scroll-lock';
import { useOverlayPresence } from '@/lib/use-overlay-presence';
import { useFocusTrap, isTopFocusTrap } from '@/lib/use-focus-trap';

/**
 * Share of the sheet height the user must drag down before releasing dismisses
 * it. Short flicks are caught by `DISMISS_VELOCITY` instead, so a quick throw
 * doesn't have to travel 30% of the sheet first (iOS-style velocity-aware
 * dismissal).
 */
const DISMISS_DISTANCE_RATIO = 0.3;
/** Downward release velocity (px/s) that dismisses regardless of the distance. */
const DISMISS_VELOCITY = 500;

/**
 * Mobile filter sheet per handoff 1b: dimmed backdrop, bottom sheet with a
 * 22px top radius and swipe-to-dismiss handle, scrollable body, STICKY accent
 * apply button. Escape and backdrop click close it; body scroll is locked
 * while open.
 *
 * The sheet can be dragged down by its handle/header zone: past 30% of its
 * height, or with a downward flick faster than 500px/s, releasing closes it
 * through `onClose`; anything else springs back. Dragging up meets resistance
 * (rubber-band) and is capped at the resting position, and dragging back above
 * the threshold cancels the dismissal.
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
  const dragControls = useDragControls();
  const dragY = useMotionValue(0);
  const sheetRef = useRef<HTMLDivElement>(null);

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

  /**
   * `dragY` outlives the gesture (and the unmounted sheet), so the offset is
   * cleared once the exit has really finished. The `open` effect covers the one
   * path that never reaches exit-complete: AnimatePresence reversing a running
   * exit when the sheet is re-opened.
   */
  const handleExitComplete = useCallback(() => {
    dragY.set(0);
    onExitComplete();
  }, [dragY, onExitComplete]);

  useEffect(() => {
    if (open) dragY.set(0);
  }, [open, dragY]);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary) return;
    // The Reset action sits in the same header zone: let it handle its own taps.
    if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragControls.start(event);
  };

  const endDrag = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const height = sheetRef.current?.offsetHeight ?? 0;
    /**
     * Measure the absolute displacement instead of `info.offset`: a gesture can
     * be started while the sheet is still springing back from the previous one,
     * and then the offset would under-report how far down the sheet actually is.
     */
    const dragged = Math.max(0, dragY.get());
    const dismissed =
      (height > 0 && dragged > height * DISMISS_DISTANCE_RATIO) ||
      // Reduced motion keeps the predictable distance rule, no momentum.
      (!reduce && info.velocity.y > DISMISS_VELOCITY);

    if (!dismissed) {
      /**
       * Cancelled (dragged back up past the threshold, or released short of
       * it): return to rest carrying the release velocity so the finger and the
       * animation meet without a seam. Under reduced motion this is a short
       * tween — same distance rule, no spring, no overshoot.
       */
      animate(
        dragY,
        0,
        reduce
          ? { duration: 0.14, ease: 'easeOut' }
          : {
              type: 'spring',
              bounce: 0,
              duration: 0.28,
              velocity: Math.max(0, info.velocity.y),
            },
      );
      return;
    }

    // Dismissal reuses the existing close path, so body scroll lock, the focus
    // trap and the Escape/backdrop handlers keep working untouched.
    onClose();
    // Let the throw continue to where the gesture was heading instead of
    // stopping dead at the release point. Reduced motion keeps the plain fade
    // from the release position (the sheet's exit has no y offset there).
    if (!reduce && height > 0) {
      animate(dragY, height + 16, {
        type: 'spring',
        bounce: 0,
        duration: 0.3,
        velocity: Math.max(0, info.velocity.y),
      });
    }
  };

  const sheetHidden = reduce ? { opacity: 0 } : { opacity: 0, y: 28 };
  const sheetShown = reduce ? { opacity: 1 } : { opacity: 1, y: 0 };

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
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
          {/*
            The drag lives on this wrapper, not on the panel: the panel keeps its
            own enter/exit `y` animation, so a drag offset never fights the
            present/exit transition. `dragListener={false}` keeps framer from
            writing `touch-action: none` on the whole sheet, which is what
            leaves the filter list free to scroll.
          */}
          <motion.div
            ref={sheetRef}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            // Resting position is the floor: pulling up is capped (and rubber
            // banded), pulling down is unconstrained so the sheet tracks the
            // finger 1:1.
            dragConstraints={{ top: 0 }}
            dragElastic={0.15}
            dragMomentum={false}
            onDragEnd={endDrag}
            style={{ y: dragY }}
            className="absolute inset-x-0 bottom-0"
          >
            <motion.div
              ref={trapRef}
              className="material-panel flex max-h-[88dvh] flex-col rounded-t-sheet shadow-none"
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
              <div className="touch-none select-none" onPointerDown={startDrag}>
                <div className="flex justify-center pt-2.5" aria-hidden>
                  <span className="h-1 w-10 rounded-pill bg-line-strong" />
                </div>
                <div className="flex items-center justify-between pb-3 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-2">
                  <h2 className="font-heading text-section font-medium text-ink">{title}</h2>
                  <button
                    type="button"
                    onClick={onReset}
                    className="focus-ring rounded-btn px-2 py-1 text-sub font-medium text-accent-hover dark:text-accent"
                  >
                    {resetLabel}
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain border-t border-line py-5 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]">
                {children}
              </div>
              <div className="border-t border-line bg-surface py-3 pb-[max(12px,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]">
                <Button variant="primary" size="lg" className="w-full" onClick={onClose}>
                  {applyLabel}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
