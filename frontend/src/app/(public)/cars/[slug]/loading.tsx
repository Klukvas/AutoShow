import { getTranslations } from 'next-intl/server';

/** Detail-page skeleton (handoff 1c): gallery frame, spec rows, sticky panel. */
export default async function ListingLoading() {
  const t = await getTranslations('catalog');
  return (
    <div
      role="status"
      aria-label={t('loading')}
      className="mx-auto max-w-[1200px] px-5 pb-16 pt-4 md:px-8 md:pt-6"
    >
      <div aria-hidden>
        <div className="skeleton hidden h-4 w-64 rounded-chip md:block" />
        <div className="skeleton mt-3 hidden h-9 w-96 rounded-btn md:block" />

        <div className="mt-0 gap-8 md:mt-6 md:grid md:grid-cols-[minmax(0,1fr)_340px] md:items-start">
          <div>
            <div className="skeleton -mx-5 h-[250px] md:mx-0 md:h-[430px] md:rounded-window" />
            <div className="mt-3 hidden gap-2.5 md:flex">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="skeleton h-16 w-[92px] rounded-btn" />
              ))}
            </div>
            <div className="mt-8 space-y-3">
              <div className="skeleton h-6 w-48 rounded-chip" />
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="skeleton h-5 rounded-chip" />
              ))}
            </div>
          </div>
          <div className="hidden md:block">
            <div className="rounded-card border border-line bg-surface p-6">
              <div className="skeleton h-9 w-40 rounded-btn" />
              <div className="skeleton mt-2 h-4 w-52 rounded-chip" />
              <div className="mt-5 space-y-2.5">
                <div className="skeleton h-[50px] rounded" />
                <div className="skeleton h-[50px] rounded" />
                <div className="skeleton h-[50px] rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
