import { getTranslations } from 'next-intl/server';
import { publicApi } from '@/lib/api/public';

/** Trust numbers strip: live counters from the public stats endpoint. */
export async function StatsBand() {
  const t = await getTranslations('home');
  let stats: { available: number; sold: number; views: number } | null = null;
  try {
    stats = await publicApi.getStats({ revalidate: 300 });
  } catch {
    return null;
  }
  if (!stats) return null;

  const items = [
    { value: stats.available, label: t('statsAvailable') },
    { value: stats.sold, label: t('statsSold') },
    { value: stats.views, label: t('statsViews') },
  ].filter((item) => item.value > 0);
  if (items.length === 0) return null;

  return (
    <section className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-[1200px] grid-cols-3 gap-4 px-5 py-9 md:px-8">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <div className="tabular font-heading text-[30px] font-extrabold text-ink md:text-[38px]">
              {item.value.toLocaleString('uk-UA')}
            </div>
            <div className="mt-1 text-sub font-medium text-ink-3">{item.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
