'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { adminApi, type ListingStatus } from '@/lib/api/admin';
import { ApiClientError } from '@/lib/api/client';
import { fetchAccessToken } from '@/lib/auth/use-access-token';
import type { AdminTelegramPost } from '@/lib/api/types';
import { Banner } from '@/components/admin/ui/banner';
import { useToast } from '@/components/admin/ui/toast';

interface TelegramPostPanelProps {
  listingId: string;
  status: ListingStatus;
  posts: AdminTelegramPost[];
  /** False when branding has no bot token/channels — panel shows a hint. */
  configured: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
}

/**
 * Post history + the manual «post to Telegram» button. Posting is queued on
 * the backend (202) — the worker delivers within seconds; a refresh shows the
 * new row.
 */
export function TelegramPostPanel({
  listingId,
  status,
  posts,
  configured,
}: TelegramPostPanelProps) {
  const t = useTranslations('admin.telegram');
  const tc = useTranslations('admin.common');
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPost = configured && (status === 'published' || status === 'reserved');

  const submit = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const accessToken = await fetchAccessToken();
      if (!accessToken) {
        setError(tc('sessionExpired'));
        return;
      }
      await adminApi.postListingToTelegram(listingId, { accessToken });
      toast(t('queued'));
      router.refresh();
    } catch (e) {
      if (e instanceof ApiClientError) setError(e.message);
      else setError(tc('errorTitle'));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {error && <Banner tone="error">{error}</Banner>}

      {posts.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {posts.map((post) => (
            <li
              key={post.chatId}
              className="flex flex-wrap items-center gap-x-2 text-[13px] font-medium text-ink-2"
            >
              <span className="font-semibold text-ink">{post.label ?? post.chatId}</span>
              <span className="text-ink-3">
                {t('postedAt', { date: formatDate(post.postedAt) })}
              </span>
              {post.soldMarkedAt && (
                <span className="rounded-[6px] bg-surface-2 px-1.5 py-0.5 text-[11.5px] font-bold text-ink-3">
                  {t('soldMark')}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] font-medium text-ink-3">
          {configured ? t('empty') : t('notConfigured')}
        </p>
      )}

      {!canPost && configured && (
        <p className="text-[12.5px] font-medium text-ink-3">{t('notPublished')}</p>
      )}

      <div>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={pending || !canPost}
          className="focus-ring inline-flex h-9 items-center rounded-[9px] border border-line-input bg-surface px-3.5 text-[12.5px] font-semibold text-ink hover:border-line-hover disabled:opacity-50"
        >
          {pending ? t('posting') : t('postButton')}
        </button>
      </div>
    </div>
  );
}
