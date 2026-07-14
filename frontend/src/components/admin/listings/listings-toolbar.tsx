'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import type { ListingStatus } from '@/lib/api/admin';

const STATUSES: ListingStatus[] = ['published', 'draft', 'reserved', 'sold', 'archived'];
const DEBOUNCE_MS = 350;

/**
 * Search (title/VIN, debounced) + status filter. Desktop: input + select
 * (handoff 1b); mobile: input + horizontally scrollable status chips (1c).
 * Any change resets cursor pagination.
 */
export function ListingsToolbar({ q, status }: { q?: string; status?: ListingStatus }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(q ?? '');
  const lastPushed = useRef(q ?? '');
  // The debounce below must always see the CURRENT status — a pending timeout
  // firing after a chip click would otherwise silently reset the filter.
  const statusRef = useRef(status);
  statusRef.current = status;

  const apply = (nextQ: string, nextStatus: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('cursor');
    params.delete('stack');
    if (nextQ) params.set('q', nextQ);
    else params.delete('q');
    if (nextStatus) params.set('status', nextStatus);
    else params.delete('status');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  // Debounced search — typing must not fire a request per keystroke.
  useEffect(() => {
    if (value === lastPushed.current) return;
    const id = setTimeout(() => {
      lastPushed.current = value;
      apply(value.trim(), statusRef.current);
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const chip = (label: string, s: ListingStatus | undefined) => {
    const active = (status ?? undefined) === s;
    return (
      <button
        key={s ?? 'all'}
        type="button"
        aria-pressed={active}
        onClick={() => apply(value.trim(), s)}
        className={cn(
          'focus-ring h-9 flex-none rounded-[8px] px-3 text-[12px] font-semibold transition-none',
          active
            ? 'bg-ink text-bg'
            : 'border border-line-input bg-surface text-ink-2 hover:border-line-hover',
        )}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex gap-[9px]">
        <div className="relative w-full max-w-[320px]">
          <svg
            viewBox="0 0 16 16"
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="m10.5 10.5 3.5 3.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label={t('listings.searchLabel')}
            placeholder={t('listings.searchPlaceholder')}
            className="focus-ring h-10 w-full rounded-[9px] border border-line-input bg-surface pl-[34px] pr-3 text-[13px] font-medium text-ink outline-none placeholder:text-ink-3 md:h-10"
          />
        </div>
        {/* Desktop status select */}
        <select
          value={status ?? ''}
          onChange={(e) => apply(value.trim(), e.target.value || undefined)}
          aria-label={t('listings.filterAll')}
          className="focus-ring hidden h-10 rounded-[9px] border border-line-input bg-surface px-3 text-[12.5px] font-semibold text-ink outline-none md:block"
        >
          <option value="">{t('listings.filterAll')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
      </div>
      {/* Mobile status chips */}
      <div className="-mx-4 flex gap-[7px] overflow-x-auto px-4 pb-0.5 md:hidden">
        {chip(t('listings.chipAll'), undefined)}
        {STATUSES.map((s) => chip(t(`status.${s}`), s))}
      </div>
    </div>
  );
}
