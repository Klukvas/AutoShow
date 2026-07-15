import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { COLLECTIONS } from '@/lib/collections';

/** Curated collection links — quick entry points + internal-linking SEO. */
export async function CollectionsSection() {
  const t = await getTranslations('home');
  return (
    <section className="mx-auto max-w-[1200px] px-5 py-12 md:px-8 md:py-16">
      <h2 className="font-heading text-title-lg font-extrabold text-ink">
        {t('collectionsTitle')}
      </h2>
      <div className="mt-6 grid grid-cols-2 gap-3.5 md:grid-cols-5">
        {COLLECTIONS.map((collection) => (
          <Link
            key={collection.key}
            href={`/collections/${collection.key}`}
            className="group focus-ring rounded-card border border-line bg-surface p-4 transition-[transform,border-color] hover:border-line-hover motion-safe:hover:-translate-y-[2px]"
          >
            <span aria-hidden className="text-[26px]">
              {collection.emoji}
            </span>
            <span className="mt-2 block text-body-md font-bold text-ink group-hover:text-accent-hover dark:group-hover:text-accent">
              {collection.titleUk}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
