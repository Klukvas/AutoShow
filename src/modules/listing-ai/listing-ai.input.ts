import { createHash } from 'node:crypto';
import type { Listing } from '../listings/entities/listing.entity';
import type { ListingMedia } from '../listings/entities/listing-media.entity';
import type { MediaRendition } from '../listings/entities/media-rendition.entity';

export const LISTING_AI_MAX_PHOTOS = 5;

/**
 * Everything the model may know about a listing. Built from an explicit
 * whitelist: VIN, seller contacts, fees, commission and sale price never
 * leave the server. Price and the free-text title/description are left out
 * on purpose: price changes often and would mark every accepted text stale,
 * and the model must rely on structured facts, not on earlier prose.
 * Keys double as `sourceField` names for fact validation.
 */
export type ListingAiInput = {
  make: string;
  model: string;
  generation: string | null;
  modification: string | null;
  year: number;
  mileageKm: number;
  bodyType: string;
  fuelType: string;
  transmission: string;
  driveType: string;
  color: string;
  engineVolumeL: number;
  powerHp: number;
  condition: Listing['condition'];
  ownersCount: number;
  isCrashed: boolean;
  customsCleared: boolean;
  /** «Торг» is standard listing wording and changes rarely, unlike the price. */
  isNegotiable: boolean;
  locationCity: string;
  locationRegion: string | null;
  options: Array<{ category: string; name: string }>;
  tags: string[];
};

export type ListingAiPhoto = { mediaId: string; s3Key: string };

/** What a draft row stores: the model input as it was when the draft was queued. */
export type ListingAiSnapshot = { input: ListingAiInput; photos: ListingAiPhoto[] };

/**
 * UTF-16 code-unit order. The hash is compared with a recomputed one over months,
 * so ordering must not depend on the runtime's ICU collation.
 */
function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

type Named = { nameUk: string; deletedAt?: Date | null } | undefined | null;

function nameOf(relation: Named, field: string): string {
  if (!relation) throw new Error(`Listing AI input: relation "${field}" is not loaded`);
  return relation.nameUk.trim();
}

function textOrNull(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Requires the catalog relations, options.option and tags.tag to be loaded. */
export function buildListingAiInput(listing: Listing): ListingAiInput {
  if (!listing.options || !listing.tags)
    throw new Error('Listing AI input: options and tags must be loaded');
  const engineVolumeL = Number(listing.engineVolumeL);
  if (!Number.isFinite(engineVolumeL))
    throw new Error('Listing AI input: engine volume is not a number');
  return {
    make: nameOf(listing.make, 'make'),
    model: nameOf(listing.model, 'model'),
    generation: textOrNull(listing.generation),
    modification: textOrNull(listing.modification),
    year: listing.year,
    mileageKm: listing.mileageKm,
    bodyType: nameOf(listing.bodyType, 'bodyType'),
    fuelType: nameOf(listing.fuelType, 'fuelType'),
    transmission: nameOf(listing.transmission, 'transmission'),
    driveType: nameOf(listing.driveType, 'driveType'),
    color: nameOf(listing.color, 'color'),
    engineVolumeL,
    powerHp: listing.powerHp,
    condition: listing.condition,
    ownersCount: listing.ownersCount,
    isCrashed: listing.isCrashed,
    customsCleared: listing.customsCleared,
    isNegotiable: listing.isNegotiable,
    locationCity: listing.locationCity.trim(),
    locationRegion: textOrNull(listing.locationRegion),
    options: listing.options
      .flatMap(({ option }) =>
        option && !option.deletedAt
          ? [{ category: option.category, name: option.nameUk.trim() }]
          : [],
      )
      .sort((a, b) => byCodeUnit(a.category, b.category) || byCodeUnit(a.name, b.name)),
    // Only published tags: unpublished ones are internal labels, not facts.
    tags: listing.tags
      .flatMap(({ tag }) => (tag && !tag.deletedAt && tag.isPublished ? [tag.nameUk.trim()] : []))
      .sort(byCodeUnit),
  };
}

const RENDITION_PREFERENCE: ReadonlyArray<Pick<MediaRendition, 'variant' | 'format'>> = [
  { variant: 'gallery', format: 'jpeg' },
  { variant: 'gallery', format: 'webp' },
  { variant: 'full', format: 'jpeg' },
  { variant: 'full', format: 'webp' },
];

/**
 * Up to five ready photos, cover first, then in gallery order. Always the
 * original upload's renditions, never an applied AI variant: the text must
 * describe the car as it really is. A gallery-size rendition keeps vision
 * cost down; the original is the fallback.
 */
export function selectListingAiPhotos(media: readonly ListingMedia[]): ListingAiPhoto[] {
  return (
    media
      .filter((m) => m.type === 'image' && m.status === 'ready' && !m.deletedAt)
      // Total order: uploads all start at position 0 and the query has no
      // ORDER BY, so ties must not fall back to physical row order.
      .sort(
        (a, b) =>
          Number(b.isCover) - Number(a.isCover) ||
          a.position - b.position ||
          a.createdAt.getTime() - b.createdAt.getTime() ||
          byCodeUnit(a.id, b.id),
      )
      .slice(0, LISTING_AI_MAX_PHOTOS)
      .map((m) => {
        const live = (m.renditions ?? []).filter((r) => !r.deletedAt);
        const rendition = RENDITION_PREFERENCE.map((wanted) =>
          live.find((r) => r.variant === wanted.variant && r.format === wanted.format),
        ).find(Boolean);
        return { mediaId: m.id, s3Key: rendition?.s3Key ?? m.originalS3Key };
      })
  );
}

/** JSON with object keys sorted at every level, so equal data hashes equally. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'number' && !Number.isFinite(value))
    throw new Error('canonicalJson: non-finite number');
  if (value && typeof value === 'object') {
    // A Date or class instance would silently hash as {}.
    if (Object.getPrototypeOf(value) !== Object.prototype)
      throw new Error('canonicalJson: only plain objects are supported');
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => byCodeUnit(a, b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * Identity of what the model sees: the whitelisted facts plus which photos.
 * Equal hashes mean an accepted text still matches the listing.
 */
export function listingAiInputHash(
  input: ListingAiInput,
  photos: readonly ListingAiPhoto[],
): string {
  // Which photos, not which rendition file or order: re-rendering or reordering
  // the gallery does not change what the text should say.
  const photoIds = photos.map((photo) => photo.mediaId).sort(byCodeUnit);
  return createHash('sha256').update(canonicalJson({ input, photoIds })).digest('hex');
}
