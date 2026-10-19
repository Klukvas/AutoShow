import React from 'react';
import { createRoot } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { AdminQueryProvider } from '../src/components/admin/query-provider';
import messages from '../messages/uk.json';
import { ListingAiPanel } from '../src/components/admin/listings/listing-ai-panel';

/** The panel next to the three form fields it fills, as in the listing form. */
function Fixture() {
  const apply = (values: Partial<Record<string, string>>) => {
    for (const [name, value] of Object.entries(values)) {
      const field = document.querySelector<HTMLTextAreaElement>(`[name="${name}"]`);
      if (field) field.value = value ?? '';
    }
  };
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <form aria-label="Оголошення" className="space-y-2">
        <textarea aria-label="Опис" name="description" defaultValue="Старий опис авто." />
        <textarea aria-label="SEO-заголовок" name="metaTitle" defaultValue="" />
        <textarea aria-label="SEO-опис" name="metaDescription" defaultValue="" />
      </form>
      <ListingAiPanel
        listingId="11111111-1111-4111-8111-111111111111"
        saved={{ description: 'Старий опис авто.', metaTitle: '', metaDescription: '' }}
        onApply={apply}
      />
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <NextIntlClientProvider locale="uk" messages={messages}>
    <AdminQueryProvider>
      <Fixture />
    </AdminQueryProvider>
  </NextIntlClientProvider>,
);
