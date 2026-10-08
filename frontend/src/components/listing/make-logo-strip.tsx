import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { CatalogMake } from '@/lib/api/types';

const MAX_BRANDS = 16;
/** Below this the strip looks broken (three lonely chips) — render nothing. */
const MIN_BRANDS = 4;

interface MakeLogoStripProps {
  makes: CatalogMake[];
  /** Currently applied ?make= slug — its chip is highlighted and clears the filter. */
  activeMake?: string;
  label: string;
}

/**
 * Horizontal brand shortcuts above the catalog grid. Only makes whose logo
 * has been fetched appear — a letter-avatar chip row would read as noise on
 * the storefront.
 */
export function MakeLogoStrip({ makes, activeMake, label }: MakeLogoStripProps) {
  const branded = makes.filter((make) => make.logoUrl).slice(0, MAX_BRANDS);
  if (branded.length < MIN_BRANDS) return null;

  return (
    <nav aria-label={label} className="mb-5 flex gap-2 overflow-x-auto pb-1">
      {branded.map((make) => {
        const active = make.slug === activeMake;
        return (
          <Link
            key={make.id}
            href={active ? '/cars' : `/cars?make=${encodeURIComponent(make.slug)}`}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'focus-ring flex flex-none items-center gap-2 rounded-btn border px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
              active
                ? 'border-accent bg-accent/[0.08] text-accent-hover dark:bg-accent/[0.14] dark:text-accent'
                : 'border-line bg-surface text-ink hover:border-line-hover',
            )}
          >
            <Image
              src={make.logoUrl!}
              alt=""
              aria-hidden
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
            />
            {make.nameUk}
          </Link>
        );
      })}
    </nav>
  );
}
