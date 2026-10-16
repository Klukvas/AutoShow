'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { adminApi } from '@/lib/api/admin';
import { ApiClientError } from '@/lib/api/client';
import type { CatalogRef } from '@/lib/api/types';
import { fetchAccessToken } from '@/lib/auth/use-access-token';
import { COLOR_NAME_MAX, checkColorName, withColor } from '@/lib/admin/color-options';
import { SelectField, inputCls } from '@/components/admin/ui/field';

interface ColorFieldProps {
  colors: readonly CatalogRef[];
  defaultValue: string;
  error: string | null;
}

const smallBtn =
  'focus-ring inline-flex h-9 items-center rounded-none px-3 text-[0.78125rem] font-medium disabled:opacity-50';
const primarySmallBtn = `${smallBtn} bg-accent text-on-accent transition-colors hover:bg-accent-hover`;
const secondarySmallBtn = `${smallBtn} border border-line-input bg-surface text-ink hover:border-line-hover`;

/**
 * Required «Колір» select plus an inline «+ Додати колір» control: the name
 * input carries no `name`, so it never leaks into the listing FormData, and
 * Enter is intercepted so it cannot submit the outer form.
 */
export function ColorField({ colors, defaultValue, error }: ColorFieldProps) {
  const t = useTranslations('admin');
  // Only inline-added colors live in state, so a refreshed catalog prop shows up.
  const [addedColors, setAddedColors] = useState<CatalogRef[]>([]);
  const options = useMemo(
    () => addedColors.reduce((merged, color) => withColor(merged, color), [...colors]),
    [colors, addedColors],
  );
  const [value, setValue] = useState(defaultValue);
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  // SelectField does not forward refs; the wrapper finds its <select>.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const errorId = useId();
  const panelId = useId();
  // Focus moves after the commit that re-renders the toggle/select.
  const [focusTarget, setFocusTarget] = useState<'toggle' | 'select' | null>(null);

  useEffect(() => {
    if (!focusTarget) return;
    const target =
      focusTarget === 'toggle' ? toggleRef.current : wrapperRef.current?.querySelector('select');
    target?.focus();
    setFocusTarget(null);
  }, [focusTarget]);

  const close = (focus: 'toggle' | 'select') => {
    setIsAdding(false);
    setDraft('');
    setAddError(null);
    setFocusTarget(focus);
  };

  const submit = async () => {
    if (isSaving) return;
    const check = checkColorName(draft);
    if (!check.ok) {
      setAddError(
        check.reason === 'required'
          ? t('form.vRequired')
          : t('form.vMaxLength', { max: COLOR_NAME_MAX }),
      );
      return;
    }
    setIsSaving(true);
    setAddError(null);
    try {
      const accessToken = await fetchAccessToken();
      if (!accessToken) {
        setAddError(t('common.sessionExpired'));
        return;
      }
      const color = await adminApi.createCatalogColor({ nameUk: check.name }, { accessToken });
      setAddedColors((current) => withColor(current, color));
      setValue(color.id);
      close('select');
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 401)
        setAddError(t('common.sessionExpired'));
      else if (cause instanceof ApiClientError && cause.status === 429)
        setAddError(t('common.rateLimited'));
      else setAddError(t('form.colorCreateFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div ref={wrapperRef}>
      <SelectField
        label={t('form.color')}
        name="colorId"
        required
        value={value}
        onChange={(event) => setValue(event.target.value)}
        error={error}
      >
        <option value="">{t('form.selectPlaceholder')}</option>
        {options.map((color) => (
          <option key={color.id} value={color.id}>
            {color.nameUk}
          </option>
        ))}
      </SelectField>
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={isAdding}
        aria-controls={panelId}
        disabled={isSaving}
        onClick={() => (isAdding ? close('toggle') : setIsAdding(true))}
        className="focus-ring mt-1.5 inline-flex items-center gap-1 text-[0.75rem] font-medium text-ink-2 hover:text-accent disabled:opacity-50"
      >
        <span aria-hidden>+</span>
        {t('form.addColor')}
      </button>
      {isAdding && (
        <div id={panelId} className="mt-2">
          <input
            autoFocus
            aria-label={t('form.colorName')}
            aria-invalid={addError ? true : undefined}
            aria-describedby={addError ? errorId : undefined}
            placeholder={t('form.colorNamePlaceholder')}
            maxLength={COLOR_NAME_MAX}
            value={draft}
            disabled={isSaving}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void submit();
              } else if (event.key === 'Escape' && !isSaving) {
                event.preventDefault();
                close('toggle');
              }
            }}
            className={inputCls(Boolean(addError))}
          />
          {addError && (
            <p
              id={errorId}
              role="alert"
              className="mt-[5px] text-[0.71875rem] font-medium text-danger"
            >
              ⚠ {addError}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={isSaving}
              className={primarySmallBtn}
            >
              {isSaving ? t('form.colorAdding') : t('form.colorAdd')}
            </button>
            <button
              type="button"
              onClick={() => close('toggle')}
              disabled={isSaving}
              className={secondarySmallBtn}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
