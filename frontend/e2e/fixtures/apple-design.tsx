import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../messages/uk.json';
import { MotionProvider } from '../../src/components/motion/motion-provider';
import { Dialog } from '../../src/components/admin/ui/dialog';
import { RowMenu } from '../../src/components/admin/ui/row-menu';
import { CatalogCombobox } from '../../src/components/admin/listings/catalog-combobox';
import { ToastProvider, useToast } from '../../src/components/admin/ui/toast';
import { MediaTile } from '../../src/components/admin/media/media-tile';
import { MediaManager } from '../../src/components/admin/media/media-manager';

// Browser-only fixture bundled by the test. Never exposed as an application route.
function Controls() {
  const [open, setOpen] = useState(false);
  const [childOpen, setChildOpen] = useState(false);
  const [selected, setSelected] = useState('');
  const [dragResult, setDragResult] = useState('idle');
  const { toast } = useToast();
  return (
    <main className="space-y-5 p-5 text-ink">
      <button className="focus-ring" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <button className="focus-ring" onClick={() => toast('Saved successfully')}>
        Show toast
      </button>
      <CatalogCombobox
        label="Make"
        name="make"
        value={selected}
        onSelect={setSelected}
        emptyLabel="No matches"
        items={[
          { id: 'audi', nameUk: 'Audi' },
          { id: 'bmw', nameUk: 'BMW' },
          { id: 'volvo', nameUk: 'Volvo' },
        ]}
      />
      <output data-testid="selected">{selected}</output>
      <div className="w-44">
        <MediaTile
          tile={{
            key: 'test',
            mediaId: 'test',
            type: 'image',
            phase: 'ready',
            progress: 100,
            isCover: false,
            previewUrl: null,
            canRetry: false,
          }}
          index={0}
          isDropTarget={false}
          isDragging={false}
          onMakeCover={() => {}}
          onDelete={() => {}}
          onRetry={() => {}}
          onReorderStart={() => setDragResult('dragging')}
          onReorderMove={() => {}}
          onReorderEnd={(cancelled) => setDragResult(cancelled ? 'cancelled' : 'dropped')}
          onHandleKeyDown={() => {}}
        />
      </div>
      <span data-testid="drag-result">{dragResult}</span>
      <section data-testid="media-manager">
        <MediaManager
          listingId="test-listing"
          initial={[
            { id: 'first', status: 'ready', isCover: true },
            { id: 'second', status: 'ready' },
          ]}
        />
      </section>
      <Dialog open={open} onClose={() => setOpen(false)} title="Parent dialog">
        <input aria-label="Dialog input" className="focus-ring" />
        <button className="focus-ring" onClick={() => setChildOpen(true)}>
          Open child
        </button>
        <RowMenu
          items={[
            { label: 'First action', onSelect: () => {} },
            { label: 'Second action', onSelect: () => {} },
          ]}
        />
        <Dialog open={childOpen} onClose={() => setChildOpen(false)} title="Child dialog">
          <button className="focus-ring">Child action</button>
        </Dialog>
      </Dialog>
    </main>
  );
}

const root = document.getElementById('root');
if (root)
  createRoot(root).render(
    <NextIntlClientProvider locale="uk" messages={messages} timeZone="Europe/Kyiv">
      <MotionProvider>
        <ToastProvider>
          <Controls />
        </ToastProvider>
      </MotionProvider>
    </NextIntlClientProvider>,
  );
