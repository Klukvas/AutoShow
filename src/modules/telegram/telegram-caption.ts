import type { Listing } from '../listings/entities/listing.entity';

/** Telegram caption hard limit; we stay well under it (structured fields only). */
export const TELEGRAM_CAPTION_LIMIT = 1024;

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatNumber(value: number | string): string {
  return Number(value).toLocaleString('uk-UA');
}

/**
 * Channel-post caption (parse_mode=HTML). Structured fields only — the long
 * description lives on the site; the post's job is to sell the click.
 * The sold variant is also what editMessageCaption writes on mark-sold.
 */
export function buildListingCaption(
  listing: Listing,
  siteUrl: string,
  opts: { sold?: boolean } = {},
): string {
  const lines: string[] = [];
  if (opts.sold) {
    lines.push('✅ <b>ПРОДАНО</b>', '');
  }
  lines.push(`🚗 <b>${escapeHtml(listing.title)}</b>`, '');

  lines.push(`📅 ${listing.year} · 🛣 ${formatNumber(listing.mileageKm)} км`);
  if (listing.fuelType?.nameUk) {
    lines.push(
      `⛽️ ${escapeHtml(listing.fuelType.nameUk)}, ${listing.engineVolumeL} л, ${listing.powerHp} к.с.`,
    );
  }
  if (listing.transmission?.nameUk) {
    lines.push(`⚙️ ${escapeHtml(listing.transmission.nameUk)}`);
  }
  lines.push(`📍 ${escapeHtml(listing.locationCity)}`, '');

  const price = `${formatNumber(listing.priceAmount)} ${listing.priceCurrency}`;
  lines.push(opts.sold ? `💵 <s>${price}</s>` : `💵 <b>${price}</b>`, '');

  const link = `${siteUrl.replace(/\/+$/, '')}/cars/${listing.slug}`;
  lines.push(`👉 <a href="${link}">Детальніше на сайті</a>`);

  const caption = lines.join('\n');
  // Defensive truncation: a pathological 255-char title still fits, but never
  // let Telegram reject the whole album over caption length.
  return caption.length > TELEGRAM_CAPTION_LIMIT
    ? `${caption.slice(0, TELEGRAM_CAPTION_LIMIT - 1)}…`
    : caption;
}
