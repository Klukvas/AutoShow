'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';

export interface RowMenuItem {
  label: string;
  onSelect: () => void;
  /** Renders the item in the danger colour (destructive actions). */
  danger?: boolean;
  disabled?: boolean;
}

/**
 * The "⋯" per-row action menu (handoff 1b): 44px touch target trigger,
 * popup with arrow-key navigation, Escape / outside-click dismiss.
 */
export function RowMenu({ items, className }: { items: RowMenuItem[]; className?: string }) {
  const t = useTranslations('admin.common');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (!rootRef.current?.contains(document.activeElement)) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        const buttons = Array.from(
          listRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [],
        );
        if (buttons.length === 0) return;
        const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          e.key === 'Home'
            ? buttons[0]
            : e.key === 'End'
              ? buttons[buttons.length - 1]
              : e.key === 'ArrowDown'
                ? buttons[(idx + 1) % buttons.length]
                : buttons[(idx - 1 + buttons.length) % buttons.length];
        next.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    rootRef.current?.addEventListener('keydown', onKey);
    const root = rootRef.current;
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      root?.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={cn('relative', className)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={t('rowMenu')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="focus-ring flex h-11 w-11 items-center justify-center rounded-none text-ink-3 hover:bg-ink/[0.04] hover:text-ink"
      >
        <svg viewBox="0 0 16 4" className="h-1 w-4" fill="currentColor" aria-hidden>
          <circle cx="2" cy="2" r="1.6" />
          <circle cx="8" cy="2" r="1.6" />
          <circle cx="14" cy="2" r="1.6" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={listRef}
            id={menuId}
            role="menu"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -4 }}
            transition={reduce ? { duration: 0.12 } : { type: 'spring', bounce: 0, duration: 0.25 }}
            style={{ transformOrigin: 'top right' }}
            className="material-panel absolute right-0 top-full z-30 mt-1 min-w-[176px] rounded-none border border-line p-1 shadow-none"
          >
            {items.map((item, idx) => (
              <button
                key={`${idx}-${item.label}`}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  triggerRef.current?.focus();
                  item.onSelect();
                }}
                className={cn(
                  'focus-ring block w-full rounded-none px-3 py-2.5 text-left text-[0.8125rem] font-medium',
                  item.danger ? 'text-danger hover:bg-danger-bg' : 'text-ink hover:bg-ink/[0.04]',
                  item.disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
