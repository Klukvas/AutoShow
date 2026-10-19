import { describe, expect, it } from 'vitest';
import {
  EMPTY_PACKAGE_DRAFT,
  isPackageDraftValid,
  packageDraftToBody,
  toggleChannel,
  type PackageDraft,
} from './placement-package-draft';

const draft = (patch: Partial<PackageDraft>): PackageDraft => ({
  ...EMPTY_PACKAGE_DRAFT,
  title: 'Telegram',
  priceUah: '200',
  ...patch,
});

describe('placement package draft', () => {
  it('turns feature lines into trimmed bullets, dropping blank lines', () => {
    const body = packageDraftToBody(draft({ featuresText: '  Пост у стрічці \n\n Історія\n  ' }));
    expect(body.features).toEqual(['Пост у стрічці', 'Історія']);
  });

  it('sends an empty description as null so the API clears it', () => {
    expect(packageDraftToBody(draft({ description: '   ' })).description).toBeNull();
  });

  it('accepts only whole, non-negative prices within the API limit', () => {
    expect(isPackageDraftValid(draft({ priceUah: '0' }))).toBe(true);
    for (const priceUah of ['', '-5', '99.5', '1e3', '1000001', 'сто']) {
      expect(isPackageDraftValid(draft({ priceUah }))).toBe(false);
    }
  });

  it('rejects a title that is too short once trimmed', () => {
    expect(isPackageDraftValid(draft({ title: '  a ' }))).toBe(false);
  });

  it('rejects more than eight features', () => {
    const featuresText = Array.from({ length: 9 }, (_, i) => `Пункт ${i + 1}`).join('\n');
    expect(isPackageDraftValid(draft({ featuresText }))).toBe(false);
  });

  it('keeps channels in the canonical order whatever order they were ticked in', () => {
    const ticked = toggleChannel(toggleChannel([], 'telegram'), 'instagram_post');
    expect(ticked).toEqual(['instagram_post', 'telegram']);
    expect(toggleChannel(ticked, 'telegram')).toEqual(['instagram_post']);
  });
});
