'use client';

import { useEffect, useId } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { useFocusTrap } from '@/lib/use-focus-trap';
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
 * Apple-fluid: the panel *materializes* — blur + scale + opacity animate
 * together (§12), critically damped so it settles without a distracting
 * overshoot (§4). Enter and exit share the same path (§7) via AnimatePresence.
 * Reduced-motion collapses it to a plain opacity cross-fade (§14).
 */
export function Dialog({ open, onClose, title, children, footer, className }: DialogProps) {
  const t = useTranslations('admin.common');
  const trapRef = useFocusTrap<HTMLDivElement>(open);
  const titleId = useId();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      unlockBodyScroll();
    };
  }, [open, onClose]);

  const panelHidden = reduce
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.94, filter: 'blur(10px)' };
  const panelShown = reduce
    ? { opacity: 1 }
    : { opacity: 1, scale: 1, filter: 'blur(0px)' };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.button
            type="button"
            aria-label={t('close')}
            onClick={onClose}
            tabIndex={-1}
            className="absolute inset-0 cursor-default bg-[rgba(20,22,27,0.5)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          />
          <motion.div
            ref={trapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn(
              'relative w-full max-w-[420px] rounded-[14px] border border-line bg-surface p-5 shadow-panel',
              className,
            )}
            initial={panelHidden}
            animate={panelShown}
            exit={panelHidden}
            transition={{
              // scale springs (critically damped, no bounce); opacity/blur
              // clear on a short tween so the material "arrives" as it settles.
              scale: { type: 'spring', bounce: 0, duration: 0.34 },
              opacity: { duration: 0.2, ease: 'easeOut' },
              filter: { duration: 0.22, ease: 'easeOut' },
            }}
            style={{ willChange: 'transform, opacity, filter' }}
          >
            <div className="flex items-start justify-between gap-4">
              <h2
                id={titleId}
                className="font-heading text-[17px] font-bold tracking-tight text-ink"
              >
                {title}
              </h2>
              <button
                type="button"
                aria-label={t('close')}
                onClick={onClose}
                className="focus-ring -mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-3 transition-colors hover:text-ink"
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
    </AnimatePresence>
  );
}
