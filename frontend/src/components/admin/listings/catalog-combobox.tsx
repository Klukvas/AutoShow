'use client';

import { useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { FieldShell, inputCls } from '@/components/admin/ui/field';

export interface ComboItem {
  id: string;
  nameUk: string;
  nameEn?: string | null;
  logoUrl?: string | null;
}

interface CatalogComboboxProps {
  label: React.ReactNode;
  /** Hidden input name — the form collects the selected id via FormData. */
  name: string;
  items: ComboItem[];
  value: string;
  onSelect: (id: string) => void;
  error?: string | null;
  required?: boolean;
  placeholder?: string;
  /** Render logo thumbnails (makes) or plain text rows (models). */
  showLogos?: boolean;
  /** Absent → creation not offered (e.g. model before a make is chosen). */
  onCreate?: (name: string) => Promise<ComboItem | null>;
  /** «Unknown value» notice above the create row. */
  unknownHint?: (name: string) => string;
  createLabel?: (name: string) => string;
  creatingLabel?: string;
  emptyLabel: string;
}

const MAX_VISIBLE = 50;

function matches(item: ComboItem, query: string): boolean {
  const q = query.toLowerCase();
  return item.nameUk.toLowerCase().includes(q) || (item.nameEn ?? '').toLowerCase().includes(q);
}

function exactMatch(items: ComboItem[], query: string): ComboItem | undefined {
  const q = query.trim().toLowerCase();
  return items.find(
    (item) => item.nameUk.toLowerCase() === q || (item.nameEn ?? '').toLowerCase() === q,
  );
}

/** Letter avatar fallback for makes whose logo hasn't been fetched (yet). */
function LogoThumb({ item }: { item: ComboItem }) {
  if (item.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tiny catalog logo from our S3
      <img
        src={item.logoUrl}
        alt=""
        aria-hidden
        className="h-[22px] w-[22px] flex-none object-contain"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[5px] bg-surface-2 text-[11px] font-extrabold text-ink-3"
    >
      {item.nameUk[0]?.toUpperCase() ?? '?'}
    </span>
  );
}

/**
 * Searchable dropdown over a catalog list (with logos for makes) that can
 * create a missing entry on the fly: an unknown name shows a notice and a
 * «create» row; the created item is selected immediately.
 */
export function CatalogCombobox({
  label,
  name,
  items,
  value,
  onSelect,
  error,
  required,
  placeholder,
  showLogos = false,
  onCreate,
  unknownHint,
  createLabel,
  creatingLabel,
  emptyLabel,
}: CatalogComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = items.find((item) => item.id === value) ?? null;
  const trimmed = query.trim();
  const filtered = useMemo(
    () => (trimmed ? items.filter((item) => matches(item, trimmed)) : items).slice(0, MAX_VISIBLE),
    [items, trimmed],
  );
  const unknown = trimmed.length > 1 && !exactMatch(items, trimmed);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const pick = (id: string) => {
    onSelect(id);
    close();
  };

  const create = async () => {
    if (!onCreate || creating || !trimmed) return;
    setCreating(true);
    try {
      const created = await onCreate(trimmed);
      if (created) pick(created.id);
    } finally {
      setCreating(false);
    }
  };

  return (
    <FieldShell label={label} required={required} error={error}>
      {({ id, describedBy }) => (
        <div
          ref={containerRef}
          className="relative"
          onBlur={(e) => {
            // Close only when focus leaves the whole combobox (input + list).
            if (!containerRef.current?.contains(e.relatedTarget as Node)) close();
          }}
        >
          <input type="hidden" name={name} value={value} />
          <div className="relative">
            {showLogos && selected && !open && (
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
                <LogoThumb item={selected} />
              </span>
            )}
            <input
              id={id}
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              aria-required={required || undefined}
              aria-autocomplete="list"
              autoComplete="off"
              value={open ? query : (selected?.nameUk ?? '')}
              placeholder={placeholder}
              onFocus={() => {
                setOpen(true);
                setQuery('');
              }}
              onChange={(e) => {
                if (!open) setOpen(true);
                setQuery(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') close();
                if (e.key === 'Enter' && open) {
                  e.preventDefault();
                  if (filtered.length > 0) pick(filtered[0].id);
                  else if (unknown && onCreate) void create();
                }
              }}
              className={cn(inputCls(Boolean(error)), showLogos && selected && !open && 'pl-10')}
            />
          </div>

          {open && (
            <div className="absolute z-30 mt-1 max-h-[290px] w-full overflow-y-auto rounded-[10px] border border-line bg-surface py-1 shadow-lg">
              <ul role="listbox">
                {filtered.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={item.id === value}
                      // onMouseDown so the pick lands before the input's blur.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pick(item.id);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13.5px] font-semibold text-ink hover:bg-ink/[0.04]',
                        item.id === value && 'bg-ink/[0.04]',
                      )}
                    >
                      {showLogos && <LogoThumb item={item} />}
                      {item.nameUk}
                      {item.nameEn && item.nameEn !== item.nameUk && (
                        <span className="font-medium text-ink-3">{item.nameEn}</span>
                      )}
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && !unknown && (
                  <li className="px-3 py-2 text-[13px] font-medium text-ink-3">{emptyLabel}</li>
                )}
              </ul>

              {unknown && onCreate && unknownHint && createLabel && (
                <div className="border-t border-line px-3 py-2.5">
                  <p className="mb-2 text-[12.5px] font-medium text-ink-3">
                    {unknownHint(trimmed)}
                  </p>
                  <button
                    type="button"
                    disabled={creating}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      void create();
                    }}
                    className="focus-ring inline-flex h-8 items-center rounded-[8px] bg-accent px-3 text-[12.5px] font-bold text-on-accent hover:bg-accent-hover disabled:opacity-50"
                  >
                    {creating ? (creatingLabel ?? '…') : createLabel(trimmed)}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </FieldShell>
  );
}
