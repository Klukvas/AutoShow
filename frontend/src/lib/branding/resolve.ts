import { cache } from 'react';
import { publicApi } from '../api/public';
import type { Branding } from '../api/types';

/**
 * Singleton site settings. React.cache dedupes within one render pass;
 * cross-request caching lives at the fetch layer in publicApi.getBranding
 * (next: { revalidate: 300, tags: ['branding'] }). Returns null on backend
 * failure — all consumers keep their hardcoded fallbacks (name 'AutoFlow',
 * accent #DA291C).
 */
export const getSiteBranding = cache(async (): Promise<Branding | null> => {
  try {
    return await publicApi.getBranding();
  } catch {
    return null;
  }
});
