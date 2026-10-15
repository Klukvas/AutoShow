import React from 'react';
import { createRoot } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { AdminQueryProvider } from '../src/components/admin/query-provider';
import messages from '../messages/uk.json';
import { MediaManager } from '../src/components/admin/media/media-manager';
import { BrandingEditor } from '../src/components/admin/branding/branding-editor';
import { ToastProvider } from '../src/components/admin/ui/toast';

createRoot(document.getElementById('root')!).render(
  <NextIntlClientProvider locale="uk" messages={messages}>
    <AdminQueryProvider>
      <ToastProvider>
        <main className="mx-auto max-w-5xl p-6">
          <h1 className="mb-6 font-heading text-2xl">Фото оголошення</h1>
          {window.location.pathname === '/settings' ? (
            <BrandingEditor
              initial={{
                id: 'site',
                logoUrl: null,
                faviconUrl: null,
                primaryColor: '#2E53E6',
                accentColor: '#243FB9',
                displayName: 'AutoFlow fixture',
                tagline: null,
                contactPhone: null,
                contactEmail: null,
                address: null,
                workingHours: null,
                socialLinks: null,
                seoDefaults: null,
                defaultCurrency: 'USD',
              }}
            />
          ) : (
            <MediaManager
              listingId="listing"
              initial={[
                {
                  id: 'media',
                  type: 'image',
                  status: 'ready',
                  thumbUrl: '/original.svg',
                  originalUrl: '/original.svg',
                  isCover: true,
                  position: 0,
                },
              ]}
            />
          )}
        </main>
      </ToastProvider>
    </AdminQueryProvider>
  </NextIntlClientProvider>,
);
