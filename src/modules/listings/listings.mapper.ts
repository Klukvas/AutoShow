import { Inject, Injectable } from '@nestjs/common';
import type { AppConfig } from '../../config/config.module';
import { StorageService } from '../storage/storage.service';
import type { Listing } from './entities/listing.entity';
import type { ListingMedia } from './entities/listing-media.entity';
import type { MediaRendition } from './entities/media-rendition.entity';

interface SrcsetEntry {
  url: string;
  width: number;
  height: number;
  format: string;
  variant: string;
  bytes: number;
}

export interface PublicListingMedia {
  id: string;
  type: 'image' | 'video';
  position: number;
  isCover: boolean;
  alt: string | null;
  originalUrl: string;
  renditions: SrcsetEntry[];
}

/**
 * Media shape for the admin panel: raw workflow fields (status/failureReason)
 * plus resolved public URLs so the back office can render thumbnails without
 * knowing the S3 key layout.
 */
export interface AdminMediaView {
  id: string;
  type: 'image' | 'video';
  status: string;
  position: number;
  isCover: boolean;
  alt: string | null;
  failureReason: string | null;
  thumbUrl: string | null;
  originalUrl: string;
}

export type AdminListingView = Omit<Listing, 'media'> & { media: AdminMediaView[] };

export interface PublicListing {
  id: string;
  slug: string;
  title: string;
  description: string;
  /** Publicly visible lifecycle states; drafts/archived never reach here. */
  status: 'published' | 'reserved' | 'sold';
  make: { id: string; nameUk: string; nameEn: string | null; slug: string };
  model: { id: string; nameUk: string; nameEn: string | null; slug: string };
  generation: string | null;
  modification: string | null;
  year: number;
  mileageKm: number;
  vin: string | null;
  bodyType: CatalogRef | null;
  fuelType: CatalogRef | null;
  transmission: CatalogRef | null;
  driveType: CatalogRef | null;
  color: CatalogRef | null;
  engineVolumeL: string;
  powerHp: number;
  condition: 'new' | 'used' | 'damaged';
  ownersCount: number;
  isCrashed: boolean;
  customsCleared: boolean;
  price: {
    amount: string;
    currency: 'USD' | 'UAH' | 'EUR';
    normalized: string;
    isNegotiable: boolean;
  };
  location: { city: string; region: string | null };
  publishedAt: string | null;
  viewsCount: number;
  media: PublicListingMedia[];
  options: Array<{ slug: string; nameUk: string; category: string }>;
  seo: {
    metaTitle: string | null;
    metaDescription: string | null;
    canonical: string;
    jsonLd: Record<string, unknown>;
  };
}

interface CatalogRef {
  id: string;
  slug: string;
  nameUk: string;
  nameEn: string | null;
}

@Injectable()
export class ListingsMapper {
  constructor(
    private readonly storage: StorageService,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
  ) {}

  public(listing: Listing): PublicListing {
    const mediaSorted = (listing.media ?? [])
      .filter((m) => m.status === 'ready' && !m.deletedAt)
      .sort((a, b) => Number(b.isCover) - Number(a.isCover) || a.position - b.position);

    const siteUrl = this.config.PUBLIC_SITE_URL.replace(/\/+$/, '');
    // The storefront serves listing detail at /cars/[slug]; keep canonical,
    // JSON-LD url and sitemap in sync with that route (they used to 404).
    const canonical = `${siteUrl}/cars/${listing.slug}`;
    const coverUrl = mediaSorted[0]
      ? this.storage.publicUrlFor(mediaSorted[0].originalS3Key)
      : null;

    return {
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      description: listing.description,
      status: listing.status as PublicListing['status'],
      make: this.makeRef(listing),
      model: this.modelRef(listing),
      generation: listing.generation,
      modification: listing.modification,
      year: listing.year,
      mileageKm: listing.mileageKm,
      vin: listing.vinVisible ? listing.vin : null,
      bodyType: this.catalogRef(listing.bodyType),
      fuelType: this.catalogRef(listing.fuelType),
      transmission: this.catalogRef(listing.transmission),
      driveType: this.catalogRef(listing.driveType),
      color: this.catalogRef(listing.color),
      engineVolumeL: listing.engineVolumeL,
      powerHp: listing.powerHp,
      condition: listing.condition,
      ownersCount: listing.ownersCount,
      isCrashed: listing.isCrashed,
      customsCleared: listing.customsCleared,
      price: {
        amount: listing.priceAmount,
        currency: listing.priceCurrency,
        normalized: listing.priceNormalized,
        isNegotiable: listing.isNegotiable,
      },
      location: { city: listing.locationCity, region: listing.locationRegion },
      publishedAt: listing.publishedAt?.toISOString() ?? null,
      viewsCount: listing.viewsCount,
      media: mediaSorted.map((m) => this.mapMedia(m)),
      options: (listing.options ?? []).map((lo) => ({
        slug: lo.option?.slug ?? '',
        nameUk: lo.option?.nameUk ?? '',
        category: lo.option?.category ?? 'other',
      })),
      seo: {
        metaTitle: listing.metaTitle,
        metaDescription: listing.metaDescription,
        canonical,
        jsonLd: this.jsonLd(listing, canonical, coverUrl),
      },
    };
  }

  /**
   * Admin view: the raw entity plus media enriched with public URLs.
   * Media is sorted by gallery position (the admin grid edits positions
   * directly, so cover-first reordering would fight the drag&drop UI).
   */
  adminListing(listing: Listing): AdminListingView {
    const media = (listing.media ?? [])
      .filter((m) => !m.deletedAt)
      .sort((a, b) => a.position - b.position)
      .map((m) => this.adminMedia(m));
    return { ...listing, media };
  }

  private adminMedia(media: ListingMedia): AdminMediaView {
    const renditions = media.renditions ?? [];
    const thumb =
      renditions.find((r) => r.variant === 'thumb' && r.format === 'webp') ??
      renditions.find((r) => r.variant === 'thumb');
    // Ready media without renditions (e.g. videos) falls back to the original.
    const readyFallback =
      media.status === 'ready' ? this.storage.publicUrlFor(media.originalS3Key) : null;
    return {
      id: media.id,
      type: media.type,
      status: media.status,
      position: media.position,
      isCover: media.isCover,
      alt: media.alt,
      failureReason: media.failureReason,
      thumbUrl: thumb ? this.storage.publicUrlFor(thumb.s3Key) : readyFallback,
      originalUrl: this.storage.publicUrlFor(media.originalS3Key),
    };
  }

  private mapMedia(media: ListingMedia): PublicListingMedia {
    return {
      id: media.id,
      type: media.type,
      position: media.position,
      isCover: media.isCover,
      alt: media.alt,
      originalUrl: this.storage.publicUrlFor(media.originalS3Key),
      renditions: (media.renditions ?? []).map((r) => this.mapRendition(r)),
    };
  }

  private mapRendition(rendition: MediaRendition): SrcsetEntry {
    return {
      url: this.storage.publicUrlFor(rendition.s3Key),
      width: rendition.width,
      height: rendition.height,
      format: rendition.format,
      variant: rendition.variant,
      bytes: Number(rendition.sizeBytes),
    };
  }

  private makeRef(listing: Listing): CatalogRef {
    return {
      id: listing.makeId,
      slug: listing.make?.slug ?? '',
      nameUk: listing.make?.nameUk ?? '',
      nameEn: listing.make?.nameEn ?? null,
    };
  }

  private modelRef(listing: Listing): CatalogRef {
    return {
      id: listing.modelId,
      slug: listing.model?.slug ?? '',
      nameUk: listing.model?.nameUk ?? '',
      nameEn: listing.model?.nameEn ?? null,
    };
  }

  private catalogRef(
    value: { id: string; slug: string; nameUk: string; nameEn: string | null } | undefined,
  ): CatalogRef | null {
    if (!value) return null;
    return {
      id: value.id,
      slug: value.slug,
      nameUk: value.nameUk,
      nameEn: value.nameEn,
    };
  }

  private jsonLd(
    listing: Listing,
    canonical: string,
    image: string | null,
  ): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'Vehicle',
      name: listing.title,
      url: canonical,
      vehicleModelDate: String(listing.year),
      mileageFromOdometer: {
        '@type': 'QuantitativeValue',
        value: listing.mileageKm,
        unitCode: 'KMT',
      },
      vehicleEngine: {
        '@type': 'EngineSpecification',
        engineDisplacement: {
          '@type': 'QuantitativeValue',
          value: listing.engineVolumeL,
          unitCode: 'LTR',
        },
        enginePower: { '@type': 'QuantitativeValue', value: listing.powerHp, unitCode: 'BHP' },
      },
      bodyType: listing.bodyType?.nameEn ?? listing.bodyType?.nameUk,
      fuelType: listing.fuelType?.nameEn ?? listing.fuelType?.nameUk,
      vehicleTransmission: listing.transmission?.nameEn ?? listing.transmission?.nameUk,
      driveWheelConfiguration: listing.driveType?.nameEn ?? listing.driveType?.nameUk,
      color: listing.color?.nameEn ?? listing.color?.nameUk,
      vehicleIdentificationNumber: listing.vinVisible ? listing.vin : undefined,
      offers: {
        '@type': 'Offer',
        priceCurrency: listing.priceCurrency,
        price: listing.priceAmount,
        availability:
          listing.status === 'published'
            ? 'InStock'
            : listing.status === 'reserved'
              ? 'LimitedAvailability'
              : 'SoldOut',
        url: canonical,
      },
      image: image ?? undefined,
    };
  }
}
