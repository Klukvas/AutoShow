import React from 'react';
import { createRoot } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import messages from '../messages/uk.json';
import { AdminQueryProvider } from '../src/components/admin/query-provider';
import { ToastProvider } from '../src/components/admin/ui/toast';
import { SectionCard } from '../src/components/admin/ui/section-card';
import { ListingForm, type ListingCatalog } from '../src/components/admin/listings/listing-form';
import {
  ListingTabPanel,
  ListingTabsProvider,
} from '../src/components/admin/listings/listing-tabs';
import type { AdminListing } from '../src/lib/api/admin';

const ref = (id: string, nameUk: string) => ({ id, slug: id, nameUk, nameEn: null });

export const catalog: ListingCatalog = {
  makes: [ref('make-1', 'BMW')],
  models: [{ ...ref('model-1', 'X5'), makeId: 'make-1' }],
  bodyTypes: [ref('body-1', 'Позашляховик')],
  fuelTypes: [ref('fuel-1', 'Дизель')],
  transmissions: [ref('tr-1', 'Автомат')],
  driveTypes: [ref('drive-1', 'Повний')],
  colors: [ref('color-1', 'Чорний')],
  options: [{ ...ref('opt-1', 'Підігрів сидінь'), category: 'comfort' }],
  tags: [{ ...ref('tag-1', 'Топ'), position: 0, isPublished: true }],
};

const listing: AdminListing = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'bmw-x5',
  title: 'BMW X5 2021 дизель',
  status: 'draft',
  version: 3,
  priceAmount: '45000',
  priceCurrency: 'USD',
  priceNormalized: '45000',
  year: 2021,
  mileageKm: 60000,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  publishedAt: null,
  makeId: 'make-1',
  modelId: 'model-1',
  bodyTypeId: 'body-1',
  fuelTypeId: 'fuel-1',
  transmissionId: 'tr-1',
  driveTypeId: 'drive-1',
  colorId: 'color-1',
  engineVolumeL: '3.0',
  powerHp: 286,
  condition: 'used',
  ownersCount: 1,
  isCrashed: false,
  customsCleared: true,
  isNegotiable: false,
  description: 'Доглянутий BMW X5, один власник, сервісна історія.',
  metaTitle: null,
  metaDescription: null,
  locationCity: 'Київ',
  options: [{ optionId: 'opt-1' }],
  tags: [],
  sellerType: 'own',
  feeType: 'none',
};

const router = {
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
};

const params = new URLSearchParams(window.location.search);
const isNew = params.get('mode') === 'new';

function Page() {
  return (
    <ListingTabsProvider initialTab={params.get('tab') ?? undefined} isSaved={!isNew}>
      <main className="mx-auto flex max-w-[900px] flex-col px-4 py-6">
        <ListingForm catalog={catalog} initial={isNew ? undefined : listing} canManageCatalog />
        {!isNew && (
          <>
            <ListingTabPanel tab="media">
              <SectionCard title="Фото та відео · 0">
                <p>Медіа-менеджер</p>
              </SectionCard>
            </ListingTabPanel>
            <ListingTabPanel tab="telegram">
              <SectionCard title="Telegram">
                <p>Публікації в Telegram</p>
              </SectionCard>
            </ListingTabPanel>
          </>
        )}
      </main>
    </ListingTabsProvider>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing fixture root');
createRoot(root).render(
  <NextIntlClientProvider locale="uk" messages={messages}>
    <AppRouterContext.Provider value={router}>
      <AdminQueryProvider>
        <ToastProvider>
          <Page />
        </ToastProvider>
      </AdminQueryProvider>
    </AppRouterContext.Provider>
  </NextIntlClientProvider>,
);
