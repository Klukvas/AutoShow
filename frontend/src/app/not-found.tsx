import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';

export default async function NotFound() {
  const t = await getTranslations('errors');
  return (
    <main className="grid min-h-dvh place-items-center bg-bg text-ink">
      <div className="w-full max-w-xl px-5 text-center">
        <p className="text-label font-semibold uppercase tracking-label-wide text-ink-3">404</p>
        <h1 className="mt-4 font-heading text-hero font-extrabold text-ink">
          {t('notFoundTitle')}
        </h1>
        <p className="mt-3 text-body-md text-ink-2">{t('notFoundBody')}</p>
        <div className="mt-8 flex justify-center">
          <Button as="link" href="/" variant="primary" size="lg">
            {t('backHome')}
          </Button>
        </div>
      </div>
    </main>
  );
}
