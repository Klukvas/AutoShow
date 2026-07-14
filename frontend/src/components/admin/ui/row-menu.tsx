'use client';

import { useEffect, useRef, useState } from 'react';
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

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const buttons = Array.from(
          listRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [],
        );
        if (buttons.length === 0) return;
        const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          e.key === 'ArrowDown'
            ? buttons[(idx + 1) % buttons.length]
            : buttons[(idx - 1 + buttons.length) % buttons.length];
        next.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        aria-label={t('rowMenu')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="focus-ring flex h-11 w-11 items-center justify-center rounded-[8px] text-ink-3 hover:bg-ink/[0.04] hover:text-ink"
      >
        <svg viewBox="0 0 16 4" className="h-1 w-4" fill="currentColor" aria-hidden>
          <circle cx="2" cy="2" r="1.6" />
          <circle cx="8" cy="2" r="1.6" />
          <circle cx="14" cy="2" r="1.6" />
        </svg>
      </button>
      {open && (
        <div
          ref={listRef}
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[176px] rounded-[10px] border border-line bg-surface p-1 shadow-panel"
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
                item.onSelect();
              }}
              className={cn(
                'focus-ring block w-full rounded-[7px] px-3 py-2.5 text-left text-[13px] font-semibold',
                item.danger ? 'text-danger hover:bg-danger-bg' : 'text-ink hover:bg-ink/[0.04]',
                item.disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
