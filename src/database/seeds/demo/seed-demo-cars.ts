import { config as loadDotenv } from 'dotenv';
import 'reflect-metadata';
import { DataSource, In, IsNull } from 'typeorm';
import { adminDataSourceOptions } from '../../data-source';
import { BodyType } from '../../../modules/catalog/entities/body-type.entity';
import { Color } from '../../../modules/catalog/entities/color.entity';
import { DriveType } from '../../../modules/catalog/entities/drive-type.entity';
import { FuelType } from '../../../modules/catalog/entities/fuel-type.entity';
import { Make } from '../../../modules/catalog/entities/make.entity';
import { Model } from '../../../modules/catalog/entities/model.entity';
import { Transmission } from '../../../modules/catalog/entities/transmission.entity';
import { VehicleOption } from '../../../modules/catalog/entities/vehicle-option.entity';
import { Listing } from '../../../modules/listings/entities/listing.entity';
import { ListingMedia } from '../../../modules/listings/entities/listing-media.entity';
import { ListingOption } from '../../../modules/listings/entities/listing-option.entity';
import { DEMO_CARS, WIKI_PAGES_BY_MODEL, type DemoCarSpec } from './demo-cars.data';
import { createSeedStorage, ingestListingPhoto, type SeedStorage } from './media-ingest';
import { downloadPhoto, fetchModelPhotoPool } from './wiki-photos';

loadDotenv();

/**
 * Dev-only fixture: ensures 25 published demo cars, each with real photos
 * (Wikimedia Commons) uploaded to S3/MinIO with all renditions pre-generated.
 * Idempotent: existing cars are kept, missing photos are topped up.
 * Run with: npm run seed:demo
 */

const PHOTOS_PER_CAR = 3;
const PUBLISH_INTERVAL_MS = 7 * 60 * 60 * 1000; // stagger publishedAt by 7h

interface CatalogRefs {
  makes: Map<string, Make>;
  models: Map<string, Model>;
  bodyTypes: Map<string, BodyType>;
  fuelTypes: Map<string, FuelType>;
  transmissions: Map<string, Transmission>;
  driveTypes: Map<string, DriveType>;
  colors: Map<string, Color>;
  options: Map<string, VehicleOption>;
}

async function loadCatalogRefs(ds: DataSource): Promise<CatalogRefs> {
  const toMap = <T extends { slug: string }>(rows: T[]) =>
    new Map(rows.map((row) => [row.slug, row]));
  const [makes, models, bodyTypes, fuelTypes, transmissions, driveTypes, colors, options] =
    await Promise.all([
      ds.getRepository(Make).find(),
      ds.getRepository(Model).find(),
      ds.getRepository(BodyType).find(),
      ds.getRepository(FuelType).find(),
      ds.getRepository(Transmission).find(),
      ds.getRepository(DriveType).find(),
      ds.getRepository(Color).find(),
      ds.getRepository(VehicleOption).find(),
    ]);
  return {
    makes: toMap(makes),
    models: toMap(models),
    bodyTypes: toMap(bodyTypes),
    fuelTypes: toMap(fuelTypes),
    transmissions: toMap(transmissions),
    driveTypes: toMap(driveTypes),
    colors: toMap(colors),
    options: toMap(options),
  };
}

/**
 * The original base seed left a media row pointing at an S3 key that was
 * never uploaded ("seed-cover.jpg") — it renders as a broken image. Remove
 * such phantoms so this seed can attach real photos.
 */
async function removePhantomSeedMedia(ds: DataSource): Promise<void> {
  const result: unknown[] = await ds.query(
    `DELETE FROM listing_media WHERE original_s3_key LIKE '%/seed-cover.jpg' RETURNING id`,
  );
  if (result.length > 0) {
    console.log(`Removed ${result.length} phantom media row(s) left by the base seed`);
  }
}

function buildListing(spec: DemoCarSpec, refs: CatalogRefs, index: number): Partial<Listing> {
  const ref = <T>(map: Map<string, T>, slug: string, kind: string): T => {
    const row = map.get(slug);
    if (!row) throw new Error(`catalog ${kind} '${slug}' not found — run 'npm run seed' first`);
    return row;
  };
  return {
    slug: spec.slug,
    status: 'published',
    makeId: ref(refs.makes, spec.makeSlug, 'make').id,
    modelId: ref(refs.models, spec.modelSlug, 'model').id,
    year: spec.year,
    mileageKm: spec.mileageKm,
    bodyTypeId: ref(refs.bodyTypes, spec.bodyTypeSlug, 'body type').id,
    fuelTypeId: ref(refs.fuelTypes, spec.fuelTypeSlug, 'fuel type').id,
    transmissionId: ref(refs.transmissions, spec.transmissionSlug, 'transmission').id,
    driveTypeId: ref(refs.driveTypes, spec.driveTypeSlug, 'drive type').id,
    colorId: ref(refs.colors, spec.colorSlug, 'color').id,
    engineVolumeL: spec.engineVolumeL,
    powerHp: spec.powerHp,
    condition: 'used',
    ownersCount: 1,
    isCrashed: false,
    customsCleared: true,
    priceAmount: spec.priceUsd.toFixed(2),
    priceCurrency: 'USD',
    priceNormalized: spec.priceUsd.toFixed(2),
    fxRate: '1.000000',
    fxRateAt: new Date(),
    isNegotiable: true,
    title: spec.title,
    description: spec.description,
    locationCity: spec.city,
    locationRegion: 'Україна',
    publishedAt: new Date(Date.now() - index * PUBLISH_INTERVAL_MS),
    sourceType: 'manual',
  };
}

async function ensureListing(
  ds: DataSource,
  spec: DemoCarSpec,
  refs: CatalogRefs,
  index: number,
): Promise<Listing> {
  const listings = ds.getRepository(Listing);
  const existing = await listings.findOne({ where: { slug: spec.slug, deletedAt: IsNull() } });
  if (existing) return existing;

  const saved = await listings.save(listings.create(buildListing(spec, refs, index)));

  const optionIds = spec.optionSlugs
    .map((slug) => refs.options.get(slug)?.id)
    .filter((id): id is string => Boolean(id));
  if (optionIds.length > 0) {
    const linkRepo = ds.getRepository(ListingOption);
    await linkRepo.save(
      optionIds.map((optionId) => linkRepo.create({ listingId: saved.id, optionId })),
    );
  }
  console.log(`Created listing ${spec.slug}`);
  return saved;
}

async function countReadyMedia(ds: DataSource, listingId: string): Promise<number> {
  return ds.getRepository(ListingMedia).count({
    where: { listingId, status: 'ready', deletedAt: IsNull() },
  });
}

/** Per-model photo pools with a rotating cursor so sibling cars differ. */
class PhotoPools {
  private readonly pools = new Map<string, { urls: string[]; cursor: number }>();

  async take(modelSlug: string, count: number): Promise<string[]> {
    let pool = this.pools.get(modelSlug);
    if (!pool) {
      const pages = WIKI_PAGES_BY_MODEL[modelSlug] ?? [];
      const urls = await fetchModelPhotoPool(pages);
      pool = { urls, cursor: 0 };
      this.pools.set(modelSlug, pool);
      console.log(`Photo pool for '${modelSlug}': ${urls.length} image(s)`);
    }
    if (pool.urls.length === 0) return [];
    const taken: string[] = [];
    for (let i = 0; i < Math.min(count, pool.urls.length); i += 1) {
      taken.push(pool.urls[(pool.cursor + i) % pool.urls.length]);
    }
    this.pools.set(modelSlug, { urls: pool.urls, cursor: pool.cursor + count });
    return taken;
  }
}

async function attachPhotos(
  ds: DataSource,
  storage: SeedStorage,
  listing: Listing,
  spec: DemoCarSpec,
  pools: PhotoPools,
): Promise<number> {
  const existing = await countReadyMedia(ds, listing.id);
  if (existing >= PHOTOS_PER_CAR) return existing;

  const urls = await pools.take(spec.modelSlug, PHOTOS_PER_CAR - existing);
  let attached = 0;
  for (const url of urls) {
    try {
      const photo = await downloadPhoto(url);
      const position = existing + attached;
      await ingestListingPhoto(ds, storage, {
        listingId: listing.id,
        photo,
        position,
        isCover: position === 0,
        alt: `${spec.title} — фото ${position + 1}`,
      });
      attached += 1;
    } catch (err) {
      console.warn(`  photo failed for ${spec.slug}: ${(err as Error).message}`);
    }
  }
  return existing + attached;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('demo seed is a dev-only fixture; refusing to run in production');
  }

  const ds = new DataSource(adminDataSourceOptions);
  await ds.initialize();
  const storage = createSeedStorage();

  try {
    const refs = await loadCatalogRefs(ds);
    await removePhantomSeedMedia(ds);

    const pools = new PhotoPools();
    const withoutPhotos: string[] = [];

    for (const [index, spec] of DEMO_CARS.entries()) {
      const listing = await ensureListing(ds, spec, refs, index);
      const photoCount = await attachPhotos(ds, storage, listing, spec, pools);
      if (photoCount === 0) withoutPhotos.push(spec.slug);
      console.log(`[${index + 1}/${DEMO_CARS.length}] ${spec.slug}: ${photoCount} photo(s)`);
    }

    const published = await ds
      .getRepository(Listing)
      .count({ where: { status: 'published', deletedAt: IsNull() } });
    console.log(`Done. Published listings: ${published}.`);
    if (withoutPhotos.length > 0) {
      console.warn(
        `Listings without photos (photo sources unavailable): ${withoutPhotos.join(', ')}`,
      );
    }
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
