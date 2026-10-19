import React from 'react';
import { createRoot } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { AdminQueryProvider } from '../src/components/admin/query-provider';
import messages from '../messages/uk.json';
import { ListingAiSettings } from '../src/components/admin/branding/listing-ai-settings';

createRoot(document.getElementById('root')!).render(
  <NextIntlClientProvider locale="uk" messages={messages}>
    <AdminQueryProvider>
      <main className="mx-auto max-w-3xl p-6">
        <ListingAiSettings />
      </main>
    </AdminQueryProvider>
  </NextIntlClientProvider>,
);
