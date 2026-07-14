import { requireServerToken } from '@/lib/auth/refresh';
import { publicApi } from '@/lib/api/public';
import { ListingForm } from '@/components/admin/listings/listing-form';
import type { CatalogModel, CatalogRef, VehicleOption } from '@/lib/api/types';

export const dynamic = 'force-dynamic';

export default async function NewListingPage() {
  const auth = await requireServerToken('/admin/listings/new');

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

  return (
    <div className="mx-auto max-w-[900px]">
      <ListingForm
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
        canManageCatalog={auth.session.user.role === 'admin'}
      />
    </div>
  );
}
