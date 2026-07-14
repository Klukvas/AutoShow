'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

/**
 * Catalog / detail error boundary (handoff 1c). A 429 from the API renders
 * the yellow rate-limit block; anything else gets the generic error state
 * with a retry button.
 */
export default function CatalogError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('catalog');
  // NOTE: in production Next.js redacts server-side error messages (only
  // `digest` survives), so this branch fires for dev builds and errors thrown
  // client-side; production RSC failures fall through to the generic state.
  const rateLimited = /\b429\b|rate.?limit/i.test(error.message);

  if (rateLimited) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <div className="flex items-start gap-3 rounded-card border border-ratelimit-line bg-ratelimit-bg p-5">
          <span aria-hidden>⏱</span>
          <div>
            <h1 className="font-heading text-section font-bold text-ratelimit">
              {t('rateLimitTitle')}
            </h1>
            <p className="mt-1 text-body-md text-ratelimit-2">{t('rateLimitBody')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-5 py-16 text-center">
      <span
        aria-hidden
        className="flex h-14 w-14 items-center justify-center rounded-input bg-danger-bg text-xl font-bold text-danger"
      >
        !
      </span>
      <h1 className="mt-5 font-heading text-section font-bold text-ink">{t('errorTitle')}</h1>
      <p className="mt-1.5 text-body-md text-ink-2">{t('errorBody')}</p>
      <Button variant="solid" className="mt-6" onClick={() => reset()}>
        {t('errorRetry')}
      </Button>
    </div>
  );
}
