'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { MAX_PAGES, buildNextStack, nextFanOut, readCursorStack } from '@/lib/catalog-cursor';
import { cn } from '@/lib/cn';

/**
 * Cursor-pagination "Завантажити ще". The URL accumulates pages instead of
 * replacing them: `cursor` is the page being appended and `stack` is the
 * comma-separated trail of cursors before it, oldest first. The root page has
 * no cursor, so we always write `stack` (even empty) on click — its presence
 * switches the RSC into accumulation mode. A bare `cursor` without a stack
 * (legacy links) still renders one page.
 *
 * A render fans out at most MAX_PAGES `listListings` calls (root, trail and
 * current cursor), so when the next click would exceed that budget the button
 * is not rendered at all — the whole point of the cap is that no already-shown
 * page can silently drop out of the list. The click handler therefore never
 * truncates the trail; only the URL parser in `lib/catalog-cursor.ts` trims
 * crafted links.
 *
 * Scrolling to the appended batch is NOT done here: this button unmounts as
 * soon as the last page is loaded (the final batch leaves no `nextCursor`),
 * which would cancel the effect before it could run. `CatalogNewBatchScroller`
 * owns that, permanently mounted next to the results.
 */
interface LoadMoreProps {
  nextCursor: string;
}

export function LoadMore({ nextCursor }: LoadMoreProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();
  const t = useTranslations('catalog');
  // The server reads every repeated `stack` param (`readCursorStack(params)`),
  // so the client must too — otherwise `?stack=a,b&stack=c` would drop `c`
  // from the trail this click writes and lose an already-shown page.
  const stackParams = searchParams.getAll('stack');
  const stack = readCursorStack({ stack: stackParams.length > 0 ? stackParams : undefined });
  const current = searchParams.get('cursor') ?? undefined;

  // Budget reached: render nothing rather than append a page and let the
  // parser trim the oldest cursor out of the already-displayed list.
  if (nextFanOut(stack, current) > MAX_PAGES) return null;

  const loadMore = () => {
    // `pending` is not a `disabled` attribute on purpose: a disabled button
    // loses focus to `body`, and the whole point of this control is that the
    // keyboard user stays on it across the navigation. The guard plus
    // aria-disabled give the same "one click at a time" contract.
    if (pending) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set('cursor', nextCursor);
    // Always present: an empty stack still flags "accumulate from the root".
    // No slicing here — the guard above guarantees we never exceed the budget.
    next.set('stack', buildNextStack(stack, current).join(','));
    start(() => router.push(`/cars?${next.toString()}`, { scroll: false }));
  };

  return (
    <Button
      variant="outline"
      onClick={loadMore}
      aria-disabled={pending}
      className={cn(
        'motion-safe:transition-opacity motion-reduce:transition-none',
        pending && 'pointer-events-none opacity-60',
      )}
    >
      {t('loadMore')}
    </Button>
  );
}
