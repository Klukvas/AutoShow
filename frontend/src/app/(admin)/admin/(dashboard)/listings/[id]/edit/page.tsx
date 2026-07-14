import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { adminApi } from '@/lib/api/admin';
import { ApiClientError } from '@/lib/api/client';
import { requireServerToken } from '@/lib/auth/refresh';
import { publicApi } from '@/lib/api/public';
import { ListingForm } from '@/components/admin/listings/listing-form';
import { MediaManager } from '@/components/admin/media/media-manager';
import { SectionCard } from '@/components/admin/ui/section-card';
import type { CatalogModel, CatalogRef, VehicleOption } from '@/lib/api/types';

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
  const t = await getTranslations('admin.media');

  let listing: Awaited<ReturnType<typeof adminApi.getListing>>;
  try {
    listing = await adminApi.getListing(id, { accessToken: auth.accessToken });
  } catch (err) {
    if (err instanceof ApiClientError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }

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
    </div>
  );
}
