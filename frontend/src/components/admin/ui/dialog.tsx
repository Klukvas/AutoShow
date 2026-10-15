'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { useOverlayPresence } from '@/lib/use-overlay-presence';
import { useFocusTrap, isTopFocusTrap } from '@/lib/use-focus-trap';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scroll-lock';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  /** Footer actions (confirm/cancel buttons). */
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Modal dialog: overlay + centred panel, focus-trapped, Escape/overlay close,
 * body scroll locked while open.
 *
 * Apple-fluid: the panel materializes with scale and opacity animated
 * together (§12), critically damped so it settles without a distracting
 * overshoot (§4). Enter and exit share the same path (§7) via AnimatePresence.
 * Reduced-motion collapses it to a plain opacity cross-fade (§14).
 */
export function Dialog({ open, onClose, title, children, footer, className }: DialogProps) {
  const t = useTranslations('admin.common');
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { present, onExitComplete } = useOverlayPresence(open);
  const trapRef = useFocusTrap<HTMLDivElement>(present && mounted);
  const titleId = useId();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!present) return;
    lockBodyScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && isTopFocusTrap(trapRef.current)) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      unlockBodyScroll();
    };
  }, [present, onClose, trapRef]);

  const panelHidden = reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 };
  const panelShown = reduce ? { opacity: 1 } : { opacity: 1, scale: 1 };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence onExitComplete={onExitComplete}>
      {open && (
        <div
          data-lenis-prevent
          className="fixed inset-0 z-[70] grid overflow-y-auto overscroll-contain p-4"
        >
          <motion.button
            type="button"
            aria-label={t('close')}
            onClick={onClose}
            tabIndex={-1}
            className="fixed inset-0 cursor-default bg-[rgba(20,22,27,0.5)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          />
          <motion.div
            ref={trapRef}
            data-lenis-prevent
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn(
              'material-panel relative m-auto w-full max-w-[420px] rounded-none border border-line p-5 shadow-none',
              className,
            )}
            initial={panelHidden}
            animate={panelShown}
            exit={panelHidden}
            transition={{
              // A critically damped scale keeps the panel responsive to reversal.
              scale: { type: 'spring', bounce: 0, duration: 0.34 },
              opacity: { duration: 0.2, ease: 'easeOut' },
            }}
            style={{ willChange: 'transform, opacity' }}
          >
            <div className="flex items-start justify-between gap-4">
              <h2
                id={titleId}
                className="font-heading text-[1.0625rem] font-medium tracking-tight text-ink"
              >
                {title}
              </h2>
              <button
                type="button"
                aria-label={t('close')}
                onClick={onClose}
                className="focus-ring -mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-none text-ink-3 transition-colors hover:text-ink"
              >
                <svg
                  viewBox="0 0 12 12"
                  className="h-3 w-3"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path d="M1 1l10 10M11 1L1 11" />
                </svg>
              </button>
            </div>
            <div className="mt-3">{children}</div>
            {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
