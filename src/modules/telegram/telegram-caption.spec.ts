import type { Listing } from '../listings/entities/listing.entity';
import { buildListingCaption, escapeHtml, TELEGRAM_CAPTION_LIMIT } from './telegram-caption';

const listing = {
  title: 'BMW M5 <Competition> & Co',
  year: 2021,
  mileageKm: 35_000,
  engineVolumeL: '4.4',
  powerHp: 625,
  fuelType: { nameUk: 'Бензин' },
  transmission: { nameUk: 'Автомат' },
  locationCity: 'Київ',
  priceAmount: '89900.00',
  priceCurrency: 'USD',
  slug: 'bmw-m5-2021',
} as unknown as Listing;

describe('telegram caption', () => {
  it('escapes HTML-sensitive characters', () => {
    expect(escapeHtml('<b> & "x"')).toBe('&lt;b&gt; &amp; "x"');
  });

  it('builds an HTML caption with escaped title, specs and site link', () => {
    const caption = buildListingCaption(listing, 'https://site.test/');
    expect(caption).toContain('🚗 <b>BMW M5 &lt;Competition&gt; &amp; Co</b>');
    expect(caption).toContain('📅 2021');
    expect(caption).toContain('⛽️ Бензин, 4.4 л, 625 к.с.');
    expect(caption).toContain('⚙️ Автомат');
    expect(caption).toContain('📍 Київ');
    expect(caption).toContain('USD');
    // trailing slash on the site URL must not produce a `//cars` link
    expect(caption).toContain('href="https://site.test/cars/bmw-m5-2021"');
    expect(caption).not.toContain('ПРОДАНО');
  });

  it('sold variant leads with the mark and strikes the price', () => {
    const caption = buildListingCaption(listing, 'https://site.test', { sold: true });
    expect(caption.startsWith('✅ <b>ПРОДАНО</b>')).toBe(true);
    expect(caption).toContain('<s>');
  });

  it('skips spec lines whose catalog relations are not loaded', () => {
    const bare = { ...listing, fuelType: undefined, transmission: undefined } as Listing;
    const caption = buildListingCaption(bare, 'https://site.test');
    expect(caption).not.toContain('⛽️');
    expect(caption).not.toContain('⚙️');
  });

  it('never exceeds the Telegram caption limit', () => {
    const long = { ...listing, title: 'x'.repeat(255), locationCity: 'y'.repeat(128) } as Listing;
    const caption = buildListingCaption(long, 'https://site.test');
    expect(caption.length).toBeLessThanOrEqual(TELEGRAM_CAPTION_LIMIT);
  });
});
