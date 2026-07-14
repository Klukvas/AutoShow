'use client';

import { useTranslations } from 'next-intl';
import { hexToRgbChannels } from '@/lib/branding/theme';
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
  if (isValidHex(accent)) vars['--accent'] = hexToRgbChannels(accent);
  if (isValidHex(accentHover)) vars['--accent-hover'] = hexToRgbChannels(accentHover);

  return (
    <div style={vars as React.CSSProperties}>
      <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
        {t('preview')}
      </div>
      <div className="mt-3.5 overflow-hidden rounded-[12px] border border-line bg-surface">
        {/* mini header */}
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          {safeLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary external logo URL
            <img src={safeLogo} alt="" className="h-[26px] w-[26px] rounded-[7px] object-cover" />
          ) : (
            <span
              aria-hidden
              className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-[#14161B] font-heading text-[13px] font-extrabold text-white"
            >
              {name[0]?.toUpperCase() ?? 'A'}
            </span>
          )}
          <span className="font-heading text-[15px] font-extrabold tracking-tight">
            {name || 'AutoFlow'}
          </span>
          <span className="ml-auto rounded-[8px] bg-accent px-[13px] py-[7px] text-[11.5px] font-bold text-on-accent">
            {t('previewCta')}
          </span>
        </div>
        {/* mini listing card */}
        <div className="p-4">
          <CarThumb className="mb-3 h-[110px] w-full rounded-[10px]" />
          <div className="font-heading text-[15px] font-bold">Porsche 911 Carrera S</div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="font-heading text-[17px] font-extrabold text-accent tabular">
              $142&nbsp;000
            </span>
            <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-on-accent">
              {t('previewMore')}
            </span>
          </div>
        </div>
      </div>
      <p className="mt-3.5 text-[12px] font-medium leading-relaxed text-ink-3">
        {t('previewNote')}
      </p>
    </div>
  );
}
