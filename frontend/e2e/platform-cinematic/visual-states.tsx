import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../messages/uk.json';
import ListingsLoading from '../../src/app/(admin)/admin/(dashboard)/listings/loading';
import AdminError from '../../src/app/(admin)/admin/(dashboard)/error';
import CatalogError from '../../src/app/(public)/cars/error';

function States() {
  const [resets, setResets] = useState(0);
  const mode = new URLSearchParams(window.location.search).get('mode');
  const reset = () => setResets((value) => value + 1);
  return (
    <div className="cinematic-admin p-5">
      {mode === 'admin-error' ? <AdminError error={new Error('Isolated visual fixture')} reset={reset} /> : mode === 'public-error' ? <CatalogError error={new Error('Isolated visual fixture')} reset={reset} /> : <ListingsLoading />}
      <output data-testid="resets">{resets}</output>
    </div>
  );
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<NextIntlClientProvider locale="uk" messages={messages} timeZone="Europe/Kyiv"><States /></NextIntlClientProvider>);
