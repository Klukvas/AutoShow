import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { HomeSectionHeading } from './home-section-heading';
import type { Collection } from '@/lib/api/types';

interface CollectionsSectionProps {
  collections: Collection[];
}

/** Curated collection links — quick entry points + internal-linking SEO. */
export async function CollectionsSection({ collections }: CollectionsSectionProps) {
  const t = await getTranslations('home');
  if (collections.length === 0) return null;
  return (
    <section className="home-container home-section">
      <HomeSectionHeading title={t('collectionsTitle')} />
      <div className="home-collections-grid">
        {collections.map((collection) => (
          <Link
            key={collection.key}
            href={`/collections/${collection.key}`}
            className="home-collection focus-ring"
          >
            <span>{collection.titleUk}</span>
            {collection.descriptionUk && <p>{collection.descriptionUk}</p>}
            <span aria-hidden className="home-collection-arrow">↗</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
