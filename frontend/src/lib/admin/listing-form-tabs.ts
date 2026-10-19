/** Tabs of the listing edit page, in display order. */
export const LISTING_TABS = ['main', 'equipment', 'description', 'media', 'telegram'] as const;
export type ListingTab = (typeof LISTING_TABS)[number];

/** Media and Telegram act on a stored listing, so a new one gets them after the first save. */
export const SAVED_ONLY_TABS: readonly ListingTab[] = ['media', 'telegram'];

const FIELD_TABS: Readonly<Record<string, ListingTab>> = {
  optionIds: 'equipment',
  tagIds: 'equipment',
  title: 'description',
  description: 'description',
  metaTitle: 'description',
  metaDescription: 'description',
};

/** The tab that holds a form field; vehicle, specs, price and seller fields live on «Основне». */
export function tabOfField(field: string): ListingTab {
  return FIELD_TABS[field] ?? 'main';
}

/** Tabs with at least one invalid field, in display order. */
export function tabsWithErrors(fields: Iterable<string>): ListingTab[] {
  const marked = new Set([...fields].map(tabOfField));
  return LISTING_TABS.filter((tab) => marked.has(tab));
}

/** Reads `?tab=`; anything unknown, or a saved-only tab of a new listing, falls back to «Основне». */
export function parseListingTab(value: unknown, isSaved: boolean): ListingTab {
  const tab = LISTING_TABS.find((candidate) => candidate === value);
  if (!tab || (!isSaved && SAVED_ONLY_TABS.includes(tab))) return 'main';
  return tab;
}
