import { getTranslations } from 'next-intl/server';

/**
 * Catalog skeleton (handoff 1c): rail placeholder + shimmering card grid.
 * The .skeleton utility disables its animation under prefers-reduced-motion.
 */
export default async function CatalogLoading() {
  const t = await getTranslations('catalog');
  return (
    <div className="md:flex" role="status" aria-label={t('loading')}>
      <aside
        aria-hidden
        className="hidden w-rail shrink-0 border-r border-line bg-surface-2 md:block"
      >
        <div className="space-y-4 px-5 py-6">
          <div className="skeleton h-[42px] rounded-input" />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="skeleton h-3 w-16 rounded-chip" />
              <div className="skeleton h-10 rounded-btn" />
            </div>
          ))}
        </div>
      </aside>

      <div aria-hidden className="min-w-0 flex-1 px-5 py-6 md:px-7">
        <div className="skeleton h-[42px] rounded-input md:hidden" />
        <div className="mt-5 flex items-end justify-between md:mt-0">
          <div>
            <div className="skeleton h-8 w-40 rounded-btn" />
            <div className="skeleton mt-2 h-4 w-56 rounded-chip" />
          </div>
          <div className="skeleton hidden h-10 w-36 rounded-btn md:block" />
        </div>
        <div className="mt-6 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-card border border-line bg-surface">
              <div className="skeleton h-[172px] sm:h-[158px]" />
              <div className="space-y-2 p-4">
                <div className="skeleton h-4 w-3/4 rounded-chip" />
                <div className="skeleton h-3 w-1/2 rounded-chip" />
                <div className="skeleton h-5 w-2/5 rounded-chip" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
