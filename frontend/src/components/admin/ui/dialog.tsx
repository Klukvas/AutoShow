'use client';

import { useEffect, useId } from 'react';
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
 * body scroll locked while open. Mobile-first: full-width with side gutters,
 * max 420px on desktop.
 */
export function Dialog({ open, onClose, title, children, footer, className }: DialogProps) {
  const t = useTranslations('admin.common');
  const trapRef = useFocusTrap<HTMLDivElement>(open);
  const titleId = useId();

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t('close')}
        onClick={onClose}
        tabIndex={-1}
        className="absolute inset-0 cursor-default bg-[rgba(20,22,27,0.5)]"
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative w-full max-w-[420px] rounded-[14px] border border-line bg-surface p-5 shadow-panel',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="font-heading text-[17px] font-bold tracking-tight text-ink">
            {title}
          </h2>
          <button
            type="button"
            aria-label={t('close')}
            onClick={onClose}
            className="focus-ring -mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-3 hover:text-ink"
          >
            <svg viewBox="0 0 12 12" className="h-3 w-3" stroke="currentColor" strokeWidth="1.6">
              <path d="M1 1l10 10M11 1L1 11" />
            </svg>
          </button>
        </div>
        <div className="mt-3">{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
