'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { adminApi } from '@/lib/api/admin';
import { fetchAccessToken } from '@/lib/auth/use-access-token';
import { useToast } from '@/components/admin/ui/toast';
import {
  isPollDue,
  pollNewLeads,
  LEAD_POLL_INTERVAL_MS,
  type LeadWatchPort,
} from '@/lib/admin/lead-watch';

/**
 * Tells an admin who is already inside the shell that a lead just came in.
 *
 * Polling, not sockets: the shell already renders the new-leads count on the
 * server, so the watcher only has to notice it growing — one tiny
 * `?status=new&limit=1` call every ~25s, and none at all in a hidden tab.
 *
 * The decisions live in `lib/admin/lead-watch`; this component is the timer,
 * the baseline ref and the wiring. Renders nothing — the toast layer is the
 * whole UI.
 */
export function LeadLiveNotifier({ initialNewCount }: { initialNewCount: number }) {
  const t = useTranslations('admin.leads');
  const router = useRouter();
  const { toast } = useToast();
  const baselineRef = useRef(initialNewCount);
  const lastPollAtRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  // Every admin navigation re-renders the shell with a fresh server count.
  // Adopt it quietly so the next poll compares against what the sidebar
  // actually shows — toasting here would announce leads the badge already has.
  useEffect(() => {
    baselineRef.current = initialNewCount;
  }, [initialNewCount]);

  useEffect(() => {
    let active = true;

    const port: LeadWatchPort = {
      getAccessToken: fetchAccessToken,
      countNewLeads: async (accessToken) => {
        const page = await adminApi.listLeads({ status: 'new', limit: '1' }, { accessToken });
        return page.total ?? page.items.length;
      },
      onArrived: (count) => {
        if (!active) return;
        toast(t('liveArrived', { count }), 'success', {
          href: '/admin/leads',
          label: t('liveOpen'),
        });
      },
      onStale: () => {
        if (active) router.refresh();
      },
    };

    const poll = async () => {
      if (inFlightRef.current || document.visibilityState !== 'visible') return;
      inFlightRef.current = true;
      lastPollAtRef.current = Date.now();
      try {
        const baseline = await pollNewLeads(baselineRef.current, port);
        if (active) baselineRef.current = baseline;
      } finally {
        inFlightRef.current = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      // Catch up after a backgrounded stretch, throttled so tab-flipping
      // cannot turn into a request loop.
      if (isPollDue(lastPollAtRef.current, Date.now())) void poll();
    };

    const timer = window.setInterval(() => void poll(), LEAD_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [router, t, toast]);

  return null;
}
