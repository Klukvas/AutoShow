import { describe, expect, it } from 'vitest';
import { parseListingTab, tabOfField, tabsWithErrors } from './listing-form-tabs';

describe('tabOfField', () => {
  it('puts texts on «Опис», options and tags on «Комплектація», the rest on «Основне»', () => {
    expect(tabOfField('metaDescription')).toBe('description');
    expect(tabOfField('title')).toBe('description');
    expect(tabOfField('tagIds')).toBe('equipment');
    expect(tabOfField('feePercent')).toBe('main');
    expect(tabOfField('makeId')).toBe('main');
  });
});

describe('tabsWithErrors', () => {
  it('lists each tab once, in display order', () => {
    expect(tabsWithErrors(['description', 'year', 'title', 'optionIds'])).toEqual([
      'main',
      'equipment',
      'description',
    ]);
    expect(tabsWithErrors([])).toEqual([]);
  });
});

describe('parseListingTab', () => {
  it('accepts known tabs', () => {
    expect(parseListingTab('media', true)).toBe('media');
    expect(parseListingTab('description', false)).toBe('description');
  });

  it('falls back to «Основне» for unknown values and saved-only tabs of a new listing', () => {
    expect(parseListingTab('nope', true)).toBe('main');
    expect(parseListingTab(undefined, true)).toBe('main');
    expect(parseListingTab(['media'], true)).toBe('main');
    expect(parseListingTab('telegram', false)).toBe('main');
  });
});
