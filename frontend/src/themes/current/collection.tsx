import Link from 'next/link';
import { ListingCard } from '@/components/listing/listing-card';
import { Button } from '@/components/ui/button';
import type { CollectionProps } from '../contract';

/** Existing collection landing markup: breadcrumbs, preset copy, cars, catalogue link. */
export function Collection({ model }: CollectionProps) {
  const { t, preset, items, baseCurrency, catalogHref } = model;
  return (
    <div className="mx-auto max-w-[1200px] px-5 pb-16 pt-8 md:px-8">
      <nav className="text-sub text-ink-3">
        <Link href="/" className="focus-ring rounded-none hover:text-ink">
          AutoFlow
        </Link>
        {' / '}
        <Link href="/cars" className="focus-ring rounded-none hover:text-ink">
          {t('title')}
        </Link>
      </nav>
      <h1 className="mt-3 font-heading text-title-lg font-medium text-ink">
        {preset.emoji} {preset.titleUk}
      </h1>
      <p className="mt-2 max-w-[620px] text-body-md leading-relaxed text-ink-2">
        {preset.descriptionUk}
      </p>

      {items.length === 0 ? (
        <p className="mt-10 text-body-md text-ink-2">{t('empty')}</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {items.map((listing, idx) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              priority={idx < 3}
              baseCurrency={baseCurrency}
            />
          ))}
        </div>
      )}

      <div className="mt-10">
        <Button as="link" href={catalogHref} variant="outline" size="lg">
          {t('collectionAllFilters')} →
        </Button>
      </div>
    </div>
  );
}
