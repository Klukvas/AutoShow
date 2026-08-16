import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { adminApi } from '@/lib/api/admin';
import { ApiClientError } from '@/lib/api/client';
import { requireServerToken } from '@/lib/auth/refresh';
import { publicApi } from '@/lib/api/public';
import { ListingForm } from '@/components/admin/listings/listing-form';
import { TelegramPostPanel } from '@/components/admin/listings/telegram-post-panel';
import { MediaManager } from '@/components/admin/media/media-manager';
import { SectionCard } from '@/components/admin/ui/section-card';
import type { AdminTelegramPost, CatalogModel, CatalogRef, VehicleOption } from '@/lib/api/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Handoff 1d + 1e: the single edit surface (form + media manager). */
export default async function EditListingPage({ params }: PageProps) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const auth = await requireServerToken(`/admin/listings/${id}/edit`);
  const [t, tTelegram] = await Promise.all([
    getTranslations('admin.media'),
    getTranslations('admin.telegram'),
  ]);

  let listing: Awaited<ReturnType<typeof adminApi.getListing>>;
  try {
    listing = await adminApi.getListing(id, { accessToken: auth.accessToken });
  } catch (err) {
    if (err instanceof ApiClientError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }

  // Telegram panel data — decorative relative to the edit flow, so failures
  // degrade to an empty history instead of breaking the page.
  const [telegramPosts, branding] = await Promise.all([
    adminApi
      .listTelegramPosts(id, { accessToken: auth.accessToken })
      .catch(() => [] as AdminTelegramPost[]),
    adminApi.getBranding({ accessToken: auth.accessToken }).catch(() => null),
  ]);
  // Editors don't receive the telegram block (it carries the bot token) —
  // show the button optimistically; the backend 422s with a clear message.
  const telegramConfigured =
    !branding || branding.telegram === undefined
      ? true
      : Boolean(branding.telegram?.botToken && branding.telegram.channels.length);

  const [makes, models, bodyTypes, fuelTypes, transmissions, driveTypes, colors, options] =
    await Promise.all([
      publicApi.listMakes().catch(() => []),
      publicApi.listModels(undefined).catch(() => [] as CatalogModel[]),
      publicApi.listSimpleCatalog<CatalogRef>('body-types').catch(() => []),
      publicApi.listSimpleCatalog<CatalogRef>('fuel-types').catch(() => []),
      publicApi.listSimpleCatalog<CatalogRef>('transmissions').catch(() => []),
      publicApi.listSimpleCatalog<CatalogRef>('drive-types').catch(() => []),
      publicApi.listSimpleCatalog<CatalogRef>('colors').catch(() => []),
      publicApi.listOptions().catch(() => [] as VehicleOption[]),
    ]);

  const media = [...(listing.media ?? [])].sort(
    (a, b) =>
      Number(b.isCover ?? false) - Number(a.isCover ?? false) ||
      (a.position ?? 0) - (b.position ?? 0),
  );

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-[22px]">
      {/* key: a 409 reload or transition bumps version → the form remounts
          with fresh values instead of keeping stale uncontrolled inputs. */}
      <ListingForm
        key={`${listing.id}-v${listing.version}`}
        catalog={{
          makes,
          models,
          bodyTypes,
          fuelTypes,
          transmissions,
          driveTypes,
          colors,
          options,
        }}
        initial={listing}
        canManageCatalog={auth.session.user.role === 'admin'}
      />
      <SectionCard
        title={`${t('title')} · ${t('count', { count: media.length })}`}
        contentClassName=""
      >
        <MediaManager listingId={listing.id} initial={media} />
      </SectionCard>
      <SectionCard title={tTelegram('title')}>
        <TelegramPostPanel
          listingId={listing.id}
          status={listing.status}
          posts={telegramPosts}
          configured={telegramConfigured}
        />
      </SectionCard>
    </div>
  );
}
