import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SectionHeading } from '@/components/ui/section-heading';
import type { Collection } from '@/lib/api/types';

interface CollectionsSectionProps {
  collections: Collection[];
  index: string;
}

/** Curated collection links — quick entry points + internal-linking SEO. */
export async function CollectionsSection({ collections, index }: CollectionsSectionProps) {
  const t = await getTranslations('home');
  if (collections.length === 0) return null;
  return (
    <section className="mx-auto max-w-[1200px] px-5 py-12 md:px-8 md:py-16">
      <SectionHeading index={index} title={t('collectionsTitle')} />
      <div className="mt-6 grid grid-cols-2 gap-3.5 md:grid-cols-5">
        {collections.map((collection) => (
          <Link
            key={collection.key}
            href={`/collections/${collection.key}`}
            className="group focus-ring rounded-card border border-line bg-surface p-4 transition-[transform,border-color] hover:border-line-hover motion-safe:hover:-translate-y-[2px]"
          >
            <span aria-hidden className="text-[26px]">
              {collection.emoji}
            </span>
            <span className="mt-2 block text-body-md font-bold text-ink group-hover:text-lot-gold">
              {collection.titleUk}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
