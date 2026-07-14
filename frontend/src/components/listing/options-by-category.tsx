import type { PublicListing } from '@/lib/api/types';

type Translate = (key: string) => string;

const CATEGORY_ORDER = ['comfort', 'safety', 'multimedia', 'interior', 'exterior', 'other'];

/**
 * "Опції та комплектація" grouped by category (handoff 1d): uppercase category
 * label, then neutral pills on the page background.
 */
export function OptionsByCategory({
  options,
  t,
}: {
  options: PublicListing['options'];
  t: Translate;
}) {
  if (options.length === 0) return null;

  const normalized = (category: string) => (CATEGORY_ORDER.includes(category) ? category : 'other');
  const groups = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: options.filter((opt) => normalized(opt.category) === cat),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-5">
      {groups.map(({ cat, items }) => (
        <div key={cat}>
          <h3 className="mb-2.5 text-label font-semibold uppercase tracking-label-wide text-ink-3">
            {t(`optionCategories.${cat}`)}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {items.map((opt) => (
              <li
                key={opt.slug}
                className="rounded-input bg-bg px-3.5 py-2 text-sub font-medium text-ink"
              >
                {opt.nameUk}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
