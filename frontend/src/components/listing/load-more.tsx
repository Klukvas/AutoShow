'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

interface LoadMoreProps {
  nextCursor: string;
}

/**
 * Cursor-pagination "Завантажити ще". Pushing the cursor into the URL keeps
 * the route shareable and lets the RSC fetch the next page on the server.
 * We DON'T accumulate cards client-side — the new URL replaces the previous
 * list, so back/forward behaves predictably for SEO crawlers.
 */
export function LoadMore({ nextCursor }: LoadMoreProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();
  const t = useTranslations('catalog');

  return (
    <Button
      variant="outline"
      onClick={() => {
        const next = new URLSearchParams(searchParams.toString());
        next.set('cursor', nextCursor);
        start(() => router.push(`/cars?${next.toString()}`, { scroll: false }));
      }}
      disabled={pending}
    >
      {t('loadMore')}
    </Button>
  );
}
