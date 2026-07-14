'use client';

import { useEffect, useRef } from 'react';
import { publicApi } from '@/lib/api/public';

/**
 * Fires a single view-tracking beacon from the browser once per mount. Doing
 * this client-side (rather than in the ISR-cached RSC read) means the backend
 * sees the real visitor IP for per-IP dedup.
 */
export function ViewBeacon({ listingId }: { listingId: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void publicApi.trackView(listingId).catch(() => undefined);
  }, [listingId]);
  return null;
}
