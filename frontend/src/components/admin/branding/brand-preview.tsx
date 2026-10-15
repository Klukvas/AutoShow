'use client';

import { useTranslations } from 'next-intl';
import { deriveDarkAccent } from '@/lib/branding/theme';
import { isValidHex } from '@/lib/admin/derive-hover';
import { CarThumb } from '@/components/admin/ui/car-thumb';

interface BrandPreviewProps {
  name: string;
  accent: string;
  accentHover: string;
  logoUrl: string | null;
}

/**
 * Live storefront miniature (handoff 1h): header + listing card re-tinted
 * instantly by overriding the --accent tokens on this subtree — exactly the
 * mechanism the real site uses, so the preview can't drift from reality.
 */
export function BrandPreview({ name, accent, accentHover, logoUrl }: BrandPreviewProps) {
  const t = useTranslations('admin.branding');
  const safeLogo = logoUrl && /^https?:\/\/\S+\.\S+/.test(logoUrl) ? logoUrl : null;
  const vars: Record<string, string> = {};
  if (isValidHex(accent)) {
    const dark = deriveDarkAccent(accent);
    vars['--accent'] = dark.accent;
    vars['--accent-hover'] = dark.accentHover;
  } else if (isValidHex(accentHover)) {
    vars['--accent-hover'] = deriveDarkAccent(accentHover).accentHover;
  }

  return (
    <div style={vars as React.CSSProperties}>
      <div className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-ink-3">
        {t('preview')}
      </div>
      <div className="homepage-cinematic mt-3.5 overflow-hidden border border-line bg-bg text-ink">
        {/* mini header */}
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          {safeLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary external logo URL
            <img src={safeLogo} alt="" className="h-[26px] w-[26px] rounded-none object-cover" />
          ) : (
            <span
              aria-hidden
              className="flex h-[26px] w-[26px] items-center justify-center rounded-none bg-[#14161B] font-heading text-[0.8125rem] font-medium text-white"
            >
              {name[0]?.toUpperCase() ?? 'A'}
            </span>
          )}
          <span className="cinematic-wordmark !text-[22px]">
            {name || 'AutoFlow'}
          </span>
          <span className="platform-primary ml-auto px-[13px] py-[7px] text-[0.71875rem] font-medium">
            {t('previewCta')}
          </span>
        </div>
        {/* mini listing card */}
        <div className="p-4">
          <CarThumb className="mb-3 h-[110px] w-full rounded-none" />
          <div className="font-heading text-[0.9375rem] font-medium">Porsche 911 Carrera S</div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="font-heading text-[1.0625rem] font-medium text-ink tabular">
              $142&nbsp;000
            </span>
            <span className="inline-flex items-center gap-2 border-b border-line-strong px-2.5 py-1 text-[0.6875rem] font-medium text-ink">
              <span aria-label={t('accentSwatch', { hex: accent })} className="inline-block h-3 w-3 border border-line-strong bg-accent" />
              {t('previewMore')}
            </span>
          </div>
        </div>
      </div>
      <p className="mt-3.5 text-[0.75rem] font-medium leading-relaxed text-ink-3">
        {t('previewNote')}
      </p>
    </div>
  );
}
