import React from 'react';
import { createRoot } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../messages/uk.json';
import { CatalogManager } from '../src/components/admin/catalog/catalog-manager';
import { ListingForm } from '../src/components/admin/listings/listing-form';
import { AdminSidebar } from '../src/components/admin/admin-sidebar';
import { ToastProvider } from '../src/components/admin/ui/toast';
import { ThemeProvider } from '../src/components/theme/theme-provider';
import { AdminQueryProvider } from '../src/components/admin/query-provider';
const role =
  new URLSearchParams(window.location.search).get('role') === 'editor' ? 'editor' : 'admin';
const root = document.getElementById('root');
if (!root) throw new Error('Missing fixture root');
createRoot(root).render(
  <NextIntlClientProvider locale="uk" messages={messages}>
    <ThemeProvider>
      <AdminQueryProvider>
        <ToastProvider>
          <div className="cinematic-admin min-h-dvh bg-bg text-ink md:flex">
            <AdminSidebar
              links={[
                { href: '/listing', key: 'listings' },
                { href: '/catalog', key: 'catalog' },
              ]}
              email={`${role}@local.fixture`}
              role={role}
              brandName="AutoFlow"
            />
            <main className="min-w-0 flex-1 px-4 py-6 md:px-[30px]">
              {window.location.pathname === '/listing' ? (
                <ListingForm
                  catalog={{
                    makes: [],
                    models: [],
                    bodyTypes: [],
                    fuelTypes: [],
                    transmissions: [],
                    driveTypes: [],
                    colors: [],
                    options: [],
                    tags: [],
                  }}
                />
              ) : (
                <CatalogManager role={role} />
              )}
            </main>
          </div>
        </ToastProvider>
      </AdminQueryProvider>
    </ThemeProvider>
  </NextIntlClientProvider>,
);
