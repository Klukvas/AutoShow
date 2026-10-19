'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import {
  LISTING_TABS,
  SAVED_ONLY_TABS,
  parseListingTab,
  type ListingTab,
} from '@/lib/admin/listing-form-tabs';

interface ListingTabsState {
  active: ListingTab;
  /** False for a listing that is not stored yet: media and Telegram wait for the first save. */
  isSaved: boolean;
  select: (tab: ListingTab) => void;
}

const ListingTabsContext = createContext<ListingTabsState | null>(null);

const isAvailable = (tab: ListingTab, isSaved: boolean) =>
  isSaved || !SAVED_ONLY_TABS.includes(tab);

/**
 * Owns the active tab of the listing page. It sits above the form, which
 * remounts on every version bump, so the open tab survives saves.
 */
export function ListingTabsProvider({
  initialTab,
  isSaved,
  children,
}: {
  initialTab?: string;
  isSaved: boolean;
  children: ReactNode;
}) {
  const [active, setActive] = useState<ListingTab>(() => parseListingTab(initialTab, isSaved));
  const select = useCallback(
    (tab: ListingTab) => {
      if (!isAvailable(tab, isSaved)) return;
      setActive(tab);
      // A new listing's page does not read `?tab=`, so only saved ones mirror it.
      if (!isSaved) return;
      // Shallow URL update: Next syncs it without refetching the page.
      const url = new URL(window.location.href);
      if (tab === 'main') url.searchParams.delete('tab');
      else url.searchParams.set('tab', tab);
      window.history.replaceState(null, '', url);
    },
    [isSaved],
  );
  const value = useMemo(() => ({ active, isSaved, select }), [active, isSaved, select]);
  return <ListingTabsContext.Provider value={value}>{children}</ListingTabsContext.Provider>;
}

/** Lets the form run without a page-level provider (fixtures, embeds). */
export function ListingTabsBoundary({
  isSaved,
  children,
}: {
  isSaved: boolean;
  children: ReactNode;
}) {
  if (useContext(ListingTabsContext)) return <>{children}</>;
  return <ListingTabsProvider isSaved={isSaved}>{children}</ListingTabsProvider>;
}

export function useListingTabs(): ListingTabsState {
  const state = useContext(ListingTabsContext);
  if (!state) throw new Error('useListingTabs must be used inside ListingTabsProvider');
  return state;
}

const tabId = (tab: ListingTab) => `listing-tab-${tab}`;
const panelId = (tab: ListingTab) => `listing-panel-${tab}`;

/** WAI-ARIA tablist: arrows, Home and End move between the available tabs. */
export function ListingTabList({ errorTabs }: { errorTabs: readonly ListingTab[] }) {
  const t = useTranslations('admin.form.tabs');
  const { active, isSaved, select } = useListingTabs();
  const available = LISTING_TABS.filter((tab) => isAvailable(tab, isSaved));

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = available.indexOf(active);
    const next = {
      ArrowRight: available[(index + 1) % available.length],
      ArrowLeft: available[(index - 1 + available.length) % available.length],
      Home: available[0],
      End: available[available.length - 1],
    }[event.key];
    if (!next) return;
    event.preventDefault();
    select(next);
    document.getElementById(tabId(next))?.focus();
  };

  return (
    <div className="mb-5">
      <div
        role="tablist"
        aria-label={t('label')}
        onKeyDown={onKeyDown}
        className="flex overflow-x-auto border-b border-line"
      >
        {LISTING_TABS.map((tab) => {
          const selected = tab === active;
          const hasErrors = errorTabs.includes(tab);
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              id={tabId(tab)}
              aria-controls={isAvailable(tab, isSaved) ? panelId(tab) : undefined}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              disabled={!isAvailable(tab, isSaved)}
              onClick={() => select(tab)}
              className={cn(
                'focus-ring -mb-px inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-[0.8125rem] sm:px-4 font-medium transition-none disabled:cursor-not-allowed disabled:opacity-45',
                selected
                  ? 'border-accent text-ink'
                  : 'border-transparent text-ink-2 hover:text-ink',
              )}
            >
              {t(tab)}
              {hasErrors && (
                <>
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-danger" />
                  <span className="sr-only">{t('hasErrors')}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
      {!isSaved && <p className="mt-2 text-[0.75rem] text-ink-3">{t('savedOnlyHint')}</p>}
    </div>
  );
}

/** Inactive panels stay mounted so unsaved input survives switching and one save reads all tabs. */
export function ListingTabPanel({
  tab,
  className,
  children,
}: {
  tab: ListingTab;
  className?: string;
  children: ReactNode;
}) {
  const { active } = useListingTabs();
  const selected = tab === active;
  return (
    <div
      role="tabpanel"
      id={panelId(tab)}
      aria-labelledby={tabId(tab)}
      hidden={!selected}
      className={selected ? className : undefined}
    >
      {children}
    </div>
  );
}

export const listingPanelId = panelId;
