import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Brackets, In, IsNull, Repository, type EntityManager } from 'typeorm';
import { catchUniqueViolation } from '../../common/db/conflict';
import {
  CursorPage,
  decodeCursor,
  encodeCursor,
  type CursorPayload,
} from '../../common/pagination/cursor';
import type { AppConfig } from '../../config/config.module';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuditLogService } from '../audit/audit-log.service';
import { BrandingService } from '../branding/branding.service';
import { FxRateProvider } from '../fx/fx-rate.provider';
import { SlugService } from '../slug/slug.service';
import { AdminListListingsQuery } from './dto/admin-list-listings.query';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListListingsQuery } from './dto/list-listings.query';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingMedia } from './entities/listing-media.entity';
import { ListingOption } from './entities/listing-option.entity';
import { MediaRendition } from './entities/media-rendition.entity';
import { Listing, type ListingStatus } from './entities/listing.entity';
import { Make } from '../catalog/entities/make.entity';
import { Model } from '../catalog/entities/model.entity';
import { BodyType } from '../catalog/entities/body-type.entity';
import { FuelType } from '../catalog/entities/fuel-type.entity';
import { Transmission } from '../catalog/entities/transmission.entity';
import { DriveType } from '../catalog/entities/drive-type.entity';
import { Color } from '../catalog/entities/color.entity';
import { VehicleOption } from '../catalog/entities/vehicle-option.entity';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Escape LIKE wildcards so user input matches literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

// Non-nullable columns: an explicit `null` in a PATCH must be rejected rather
// than crashing (engineVolumeL/priceAmount) or violating a NOT NULL constraint.
const NON_NULLABLE_UPDATE_KEYS = [
  'makeId',
  'modelId',
  'year',
  'mileageKm',
  'vinVisible',
  'bodyTypeId',
  'fuelTypeId',
  'transmissionId',
  'driveTypeId',
  'colorId',
  'engineVolumeL',
  'powerHp',
  'condition',
  'ownersCount',
  'isCrashed',
  'customsCleared',
  'priceAmount',
  'priceCurrency',
  'title',
  'description',
  'locationCity',
  'isNegotiable',
  'optionIds',
  'sellerType',
  'feeType',
] as const;

const LIST_RELATIONS = [
  'make',
  'model',
  'bodyType',
  'fuelType',
  'transmission',
  'driveType',
  'color',
  'media',
  'media.renditions',
];

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    @InjectRepository(ListingOption)
    private readonly listingOptions: Repository<ListingOption>,
    @InjectRepository(Make) private readonly makes: Repository<Make>,
    @InjectRepository(Model) private readonly models: Repository<Model>,
    @InjectRepository(BodyType) private readonly bodyTypes: Repository<BodyType>,
    @InjectRepository(FuelType) private readonly fuelTypes: Repository<FuelType>,
    @InjectRepository(Transmission) private readonly transmissions: Repository<Transmission>,
    @InjectRepository(DriveType) private readonly driveTypes: Repository<DriveType>,
    @InjectRepository(Color) private readonly colors: Repository<Color>,
    @InjectRepository(VehicleOption) private readonly options: Repository<VehicleOption>,
    @InjectRepository(ListingMedia)
    private readonly media: Repository<ListingMedia>,
    private readonly branding: BrandingService,
    private readonly fx: FxRateProvider,
    private readonly slug: SlugService,
    private readonly audit: AuditLogService,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
  ) {}

  /* =====================================================================
   *  Public read
   * ===================================================================== */

  async findPublishedPage(query: ListListingsQuery): Promise<CursorPage<Listing>> {
    const limit = query.limit ?? 24;
    const sort = query.sort ?? 'newest';

    const qb = this.listings
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.make', 'make')
      .leftJoinAndSelect('l.model', 'model')
      .leftJoinAndSelect('l.bodyType', 'bodyType')
      .leftJoinAndSelect('l.fuelType', 'fuelType')
      .leftJoinAndSelect('l.transmission', 'transmission')
      .leftJoinAndSelect('l.driveType', 'driveType')
      .leftJoinAndSelect('l.color', 'color')
      .leftJoinAndSelect('l.media', 'media', "media.status = 'ready'")
      .leftJoinAndSelect('media.renditions', 'renditions')
      // Reserved cars stay in the catalog (with a badge) — buyers can still
      // inquire; sold cars leave the catalog but keep their detail page.
      .where('l.status IN (:...statuses)', { statuses: ['published', 'reserved'] })
      .andWhere('l.deleted_at IS NULL')
      // Sort key for `sort=newest` is published_at; guard against NULL so
      // cursor pagination can't produce/decode an empty-string sort key.
      .andWhere('l.published_at IS NOT NULL');

    if (query.make) qb.andWhere('make.slug = :make', { make: query.make });
    if (query.model) qb.andWhere('model.slug = :model', { model: query.model });
    if (query.bodyType) qb.andWhere('bodyType.slug = :bodyType', { bodyType: query.bodyType });
    if (query.fuelType) qb.andWhere('fuelType.slug = :fuelType', { fuelType: query.fuelType });
    if (query.transmission)
      qb.andWhere('transmission.slug = :transmission', { transmission: query.transmission });
    if (query.driveType) qb.andWhere('driveType.slug = :driveType', { driveType: query.driveType });
    if (query.condition) qb.andWhere('l.condition = :condition', { condition: query.condition });
    if (query.city) qb.andWhere('LOWER(l.location_city) = LOWER(:city)', { city: query.city });
    if (query.priceMin != null)
      qb.andWhere('l.price_normalized >= :priceMin', { priceMin: query.priceMin });
    if (query.priceMax != null)
      qb.andWhere('l.price_normalized <= :priceMax', { priceMax: query.priceMax });
    if (query.yearMin != null) qb.andWhere('l.year >= :yearMin', { yearMin: query.yearMin });
    if (query.yearMax != null) qb.andWhere('l.year <= :yearMax', { yearMax: query.yearMax });
    if (query.mileageMax != null)
      qb.andWhere('l.mileage_km <= :mileageMax', { mileageMax: query.mileageMax });

    if (query.q) {
      // Free-text search across the human-facing fields. Escape LIKE wildcards
      // so a user typing "50%" searches for the literal, not a pattern.
      const term = `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      qb.andWhere(
        new Brackets((b) => {
          b.where('l.title ILIKE :q', { q: term })
            .orWhere('make.nameUk ILIKE :q')
            .orWhere('make.nameEn ILIKE :q')
            .orWhere('model.nameUk ILIKE :q')
            .orWhere('model.nameEn ILIKE :q')
            .orWhere('l.location_city ILIKE :q');
        }),
      );
    }

    if (query.options?.length) {
      // Each option becomes an EXISTS subquery: ?options[]=leather&options[]=camera => AND across all.
      query.options.forEach((slug, idx) => {
        const sub = qb
          .subQuery()
          .select('1')
          .from(ListingOption, `lo${idx}`)
          .innerJoin('catalog_vehicle_options', `opt${idx}`, `lo${idx}.option_id = opt${idx}.id`)
          .where(`lo${idx}.listing_id = l.id`)
          .andWhere(`opt${idx}.slug = :optSlug${idx}`)
          .getQuery();
        qb.andWhere(`EXISTS ${sub}`, { [`optSlug${idx}`]: slug });
      });
    }

    // `orderKey` is an entity property path — required by TypeORM's take()+join
    // pagination, which maps ORDER BY columns through entity metadata.
    // `whereKey` is the raw column expression for the keyset cursor SQL.
    const { orderKey, whereKey, direction } = this.sortMapping(sort);
    qb.orderBy(orderKey, direction).addOrderBy('l.id', direction);

    // Total matching the FILTERS (not the cursor window) for the "N cars" facet
    // readout. Clone before the cursor/take are applied; getCount() counts
    // distinct listing ids so the media/renditions joins don't inflate it.
    const total = await qb.clone().getCount();

    // A crafted or sort-mismatched cursor (e.g. a price cursor reused after the
    // user switched to sort=newest) would otherwise reach Postgres and blow up
    // with a cast error (22P02 → 500). Validate it against the active sort and
    // silently fall back to page one on mismatch.
    const cursor = this.validCursorFor(sort, query.cursor ? decodeCursor(query.cursor) : null);
    if (cursor) {
      const compareOp = direction === 'DESC' ? '<' : '>';
      qb.andWhere(
        new Brackets((b) => {
          b.where(`${whereKey} ${compareOp} :ck`, { ck: cursor.k }).orWhere(
            new Brackets((bb) => {
              bb.where(`${whereKey} = :ck`).andWhere(`l.id ${compareOp} :ci`, {
                ci: cursor.i,
              });
            }),
          );
        }),
      );
    }

    qb.take(limit + 1);
    const rows = await qb.getMany();

    let nextCursor: string | null = null;
    let items = rows;
    if (rows.length > limit) {
      items = rows.slice(0, limit);
      const last = items[items.length - 1];
      const k = this.cursorKeyOf(sort, last);
      const payload: CursorPayload = { k, i: last.id };
      nextCursor = encodeCursor(payload);
    }
    return { items, nextCursor, total };
  }

  async findPublishedBySlug(slug: string): Promise<Listing> {
    const listing = await this.listings
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.make', 'make')
      .leftJoinAndSelect('l.model', 'model')
      .leftJoinAndSelect('l.bodyType', 'bodyType')
      .leftJoinAndSelect('l.fuelType', 'fuelType')
      .leftJoinAndSelect('l.transmission', 'transmission')
      .leftJoinAndSelect('l.driveType', 'driveType')
      .leftJoinAndSelect('l.color', 'color')
      .leftJoinAndSelect('l.media', 'media', "media.status = 'ready'")
      .leftJoinAndSelect('media.renditions', 'renditions')
      .leftJoinAndSelect('l.options', 'options')
      .leftJoinAndSelect('options.option', 'option')
      .where('l.slug = :slug', { slug })
      // A sold car's page stays alive ("Продано" badge) — killing it would
      // 404 indexed URLs and hide social proof.
      .andWhere('l.status IN (:...statuses)', { statuses: ['published', 'reserved', 'sold'] })
      .andWhere('l.deleted_at IS NULL')
      .getOne();
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  /* =====================================================================
   *  Admin CRUD
   * ===================================================================== */

  async adminList(query: AdminListListingsQuery): Promise<CursorPage<Listing>> {
    const limit = query.limit ?? 24;
    const qb = this.listings
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.make', 'make')
      .leftJoinAndSelect('l.model', 'model')
      .leftJoinAndSelect('l.media', 'media')
      // Renditions feed the table thumbnails (thumb.webp via the admin mapper).
      .leftJoinAndSelect('media.renditions', 'renditions')
      .where('l.deleted_at IS NULL')
      // Property paths (not raw column names) — see findPublishedPage.
      .orderBy('l.createdAt', 'DESC')
      .addOrderBy('l.id', 'DESC');

    if (query.status) qb.andWhere('l.status = :status', { status: query.status });
    if (query.q) {
      // Admin search covers title AND VIN (the storefront search deliberately
      // excludes VINs — they are staff-facing identifiers).
      qb.andWhere(
        new Brackets((b) => {
          b.where('l.title ILIKE :q', { q: `%${escapeLike(query.q!)}%` }).orWhere('l.vin ILIKE :q');
        }),
      );
    }
    // Total matching the filters, independent of the cursor window — feeds the
    // list header counters ("N всього · M чернеток") in the admin UI.
    const total = await qb.clone().getCount();

    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      if (cursor) {
        qb.andWhere(
          new Brackets((b) => {
            b.where('l.created_at < :ck', { ck: cursor.k }).orWhere(
              new Brackets((bb) => {
                bb.where('l.created_at = :ck').andWhere('l.id < :ci', { ci: cursor.i });
              }),
            );
          }),
        );
      }
    }
    qb.take(limit + 1);
    const rows = await qb.getMany();
    let nextCursor: string | null = null;
    let items = rows;
    if (rows.length > limit) {
      items = rows.slice(0, limit);
      const last = items[items.length - 1];
      nextCursor = encodeCursor({ k: last.createdAt.toISOString(), i: last.id });
    }
    return { items, nextCursor, total };
  }

  async adminFindById(id: string): Promise<Listing> {
    const listing = await this.listings.findOne({
      where: { id, deletedAt: IsNull() },
      relations: LIST_RELATIONS.concat(['options', 'options.option']),
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  async create(dto: CreateListingDto, actor: AuthenticatedUser): Promise<Listing> {
    await this.assertCatalogRefs(dto);
    const slugBase = await this.buildSlugBase(dto);
    const slug = await this.slug.unique(slugBase, {
      exists: async (candidate) =>
        (await this.listings.count({ where: { slug: candidate, deletedAt: IsNull() } })) > 0,
    });

    const { defaultCurrency } = await this.branding.getCurrent();
    const fx = await this.fx.convert(String(dto.priceAmount), dto.priceCurrency, defaultCurrency);

    const listing = this.listings.create({
      ...dto,
      slug,
      status: 'draft',
      engineVolumeL: dto.engineVolumeL.toFixed(1),
      priceAmount: dto.priceAmount.toFixed(2),
      priceNormalized: fx.value,
      fxRate: fx.rate,
      fxRateAt: fx.asOf,
      isNegotiable: dto.isNegotiable ?? false,
      vinVisible: dto.vinVisible ?? false,
      sourceType: 'manual',
      feePercent: dto.feePercent !== undefined ? dto.feePercent.toFixed(2) : null,
      feeFixedAmount: dto.feeFixedAmount !== undefined ? dto.feeFixedAmount.toFixed(2) : null,
    });

    const saved = await this.listings.manager.transaction(async (em) => {
      const created = await catchUniqueViolation(
        () => em.save(listing),
        'Slug conflict — a listing with this slug already exists. Please retry.',
      );
      if (dto.optionIds?.length) {
        await this.replaceOptions(em, created.id, dto.optionIds);
      }
      return created;
    });

    await this.audit.record({
      action: 'listing.create',
      entityType: 'listing',
      entityId: saved.id,
      diff: { after: { slug, status: saved.status, title: saved.title } },
      actorId: actor.id,
      actorRole: actor.role,
    });

    return this.adminFindById(saved.id);
  }

  async update(id: string, dto: UpdateListingDto, actor: AuthenticatedUser): Promise<Listing> {
    this.rejectExplicitNulls(dto);
    const current = await this.adminFindById(id);
    if (current.version !== dto.version) {
      throw new ConflictException(
        `Listing was modified by someone else (current version: ${current.version})`,
      );
    }
    if (current.status === 'sold') {
      throw new ForbiddenException('Sold listings are read-only');
    }
    await this.assertCatalogRefs(dto, current);

    const patch: Partial<Listing> = {};
    const trackedKeys: Array<keyof Listing> = [
      'makeId',
      'modelId',
      'generation',
      'modification',
      'year',
      'mileageKm',
      'vin',
      'vinVisible',
      'bodyTypeId',
      'fuelTypeId',
      'transmissionId',
      'driveTypeId',
      'colorId',
      'powerHp',
      'condition',
      'ownersCount',
      'isCrashed',
      'customsCleared',
      'title',
      'description',
      'locationCity',
      'locationRegion',
      'metaTitle',
      'metaDescription',
      'isNegotiable',
      'sellerType',
      'sellerName',
      'sellerPhone',
      'feeType',
    ];
    for (const key of trackedKeys) {
      if (dto[key as keyof UpdateListingDto] !== undefined) {
        (patch as Record<string, unknown>)[key] = dto[key as keyof UpdateListingDto];
      }
    }
    if (dto.engineVolumeL !== undefined) {
      patch.engineVolumeL = dto.engineVolumeL.toFixed(1);
    }
    if (dto.feePercent !== undefined) {
      patch.feePercent = dto.feePercent === null ? null : dto.feePercent.toFixed(2);
    }
    if (dto.feeFixedAmount !== undefined) {
      patch.feeFixedAmount = dto.feeFixedAmount === null ? null : dto.feeFixedAmount.toFixed(2);
    }

    const priceChanged =
      dto.priceAmount !== undefined && Number(dto.priceAmount).toFixed(2) !== current.priceAmount;
    const currencyChanged =
      dto.priceCurrency !== undefined && dto.priceCurrency !== current.priceCurrency;
    if (priceChanged || currencyChanged) {
      const amount =
        dto.priceAmount !== undefined ? Number(dto.priceAmount) : Number(current.priceAmount);
      const currency = dto.priceCurrency ?? current.priceCurrency;
      const { defaultCurrency } = await this.branding.getCurrent();
      const fx = await this.fx.convert(String(amount), currency, defaultCurrency);
      patch.priceAmount = amount.toFixed(2);
      patch.priceCurrency = currency;
      patch.priceNormalized = fx.value;
      patch.fxRate = fx.rate;
      patch.fxRateAt = fx.asOf;
    }

    await this.listings.manager.transaction(async (em) => {
      await this.updateWithVersion(current.id, current.version, patch, em);
      if (dto.optionIds !== undefined) {
        await this.replaceOptions(em, current.id, dto.optionIds);
      }
    });

    await this.audit.record({
      action: 'listing.update',
      entityType: 'listing',
      entityId: current.id,
      diff: { patch },
      actorId: actor.id,
      actorRole: actor.role,
    });

    return this.adminFindById(current.id);
  }

  async softDelete(id: string, actor: AuthenticatedUser): Promise<void> {
    const current = await this.adminFindById(id);
    const mediaIds = (current.media ?? []).map((m) => m.id);
    await this.listings.manager.transaction(async (em) => {
      // Direct softDelete by id — do NOT softRemove(current), which would try to
      // cascade into ListingOption (no delete-date column) and throw.
      await em.softDelete(Listing, { id });
      // Soft-remove the listing's media so media endpoints stop operating on
      // orphans; MaintenanceWorker sweeps the S3 objects (see cleanup sweep).
      if (mediaIds.length) {
        await em.softDelete(ListingMedia, { id: In(mediaIds) });
        await em.softDelete(MediaRendition, { mediaId: In(mediaIds) });
      }
    });
    await this.audit.record({
      action: 'listing.delete',
      entityType: 'listing',
      entityId: id,
      actorId: actor.id,
      actorRole: actor.role,
    });
  }

  /* =====================================================================
   *  Status transitions
   * ===================================================================== */

  async transition(
    id: string,
    target: 'publish' | 'archive' | 'mark-sold' | 'reserve' | 'unreserve',
    version: number,
    actor: AuthenticatedUser,
    opts?: { salePriceAmount?: number },
  ): Promise<Listing> {
    const current = await this.adminFindById(id);
    if (current.version !== version) {
      throw new ConflictException('Listing was modified by someone else');
    }

    const from = current.status;
    const to = this.nextStatus(from, target);
    if (!this.isAllowed(from, target)) {
      throw new ForbiddenException(`Transition ${from} -> ${target} not allowed`);
    }

    const patch: Partial<Listing> = { status: to };
    // First publish stamps publishedAt; re-publishing from archived/reserved
    // preserves the original date so SEO/sitemap don't see a fake "freshly
    // listed" timestamp.
    if (target === 'publish' && !current.publishedAt) patch.publishedAt = new Date();
    if (target === 'mark-sold') {
      patch.soldAt = new Date();
      // Deal economics: the final price defaults to the asking price; the
      // platform's earnings are stamped once, at the moment of sale.
      const salePrice = opts?.salePriceAmount ?? Number(current.priceAmount);
      patch.salePriceAmount = salePrice.toFixed(2);
      patch.commissionAmount = this.commissionFor(current, salePrice).toFixed(2);
    }

    await this.updateWithVersion(current.id, current.version, patch);

    await this.audit.record({
      action: `listing.${target}`,
      entityType: 'listing',
      entityId: current.id,
      diff: { from, to },
      actorId: actor.id,
      actorRole: actor.role,
    });
    return this.adminFindById(current.id);
  }

  /* =====================================================================
   *  Helpers
   * ===================================================================== */

  /** Platform earnings for a sale, in the listing's price currency. */
  private commissionFor(listing: Listing, salePrice: number): number {
    switch (listing.feeType) {
      case 'fixed':
        return Number(listing.feeFixedAmount ?? 0);
      case 'percent':
        return (salePrice * Number(listing.feePercent ?? 0)) / 100;
      default:
        return 0;
    }
  }

  private isAllowed(from: ListingStatus, target: string): boolean {
    const map: Record<string, ListingStatus[]> = {
      publish: ['draft', 'archived', 'reserved'],
      archive: ['draft', 'published', 'reserved'],
      'mark-sold': ['published', 'reserved'],
      reserve: ['published'],
      unreserve: ['reserved'],
    };
    return map[target]?.includes(from) ?? false;
  }

  private nextStatus(_from: ListingStatus, target: string): ListingStatus {
    switch (target) {
      case 'publish':
        return 'published';
      case 'archive':
        return 'archived';
      case 'mark-sold':
        return 'sold';
      case 'reserve':
        return 'reserved';
      case 'unreserve':
        return 'published';
      default:
        throw new Error(`Unknown transition ${target}`);
    }
  }

  /**
   * PATCH bodies are PartialType + IsOptional, which lets an explicit `null`
   * pass validation. For non-nullable columns that null would either crash
   * (engineVolumeL.toFixed, optionIds.length) or violate a NOT NULL constraint,
   * so reject it up front with 400 instead of a 500.
   */
  /**
   * Cursor keys are compared directly in SQL against a typed column, so a key
   * of the wrong shape (non-numeric for a price sort, non-date for newest,
   * non-UUID tiebreak) triggers a Postgres cast error. Reject such cursors and
   * treat them as "no cursor" so the endpoint returns page one instead of 500.
   */
  private validCursorFor(sort: string, cursor: CursorPayload | null): CursorPayload | null {
    if (!cursor) return null;
    if (!UUID_RE.test(cursor.i)) return null;
    const isNumeric = /^-?\d+(\.\d+)?$/.test(cursor.k);
    const isIsoDate = !Number.isNaN(Date.parse(cursor.k));
    switch (sort) {
      case 'price_asc':
      case 'price_desc':
      case 'year_asc':
      case 'year_desc':
      case 'mileage_asc':
        return isNumeric ? cursor : null;
      case 'newest':
      default:
        return isIsoDate ? cursor : null;
    }
  }

  private rejectExplicitNulls(dto: UpdateListingDto): void {
    for (const key of NON_NULLABLE_UPDATE_KEYS) {
      if ((dto as unknown as Record<string, unknown>)[key] === null) {
        throw new BadRequestException(`${key} may not be null`);
      }
    }
  }

  private async buildSlugBase(dto: CreateListingDto): Promise<string> {
    const make = await this.makes.findOne({ where: { id: dto.makeId } });
    const model = await this.models.findOne({ where: { id: dto.modelId } });
    if (!make) throw new NotFoundException('make not found');
    if (!model) throw new NotFoundException('model not found');
    return [make.slug, model.slug, dto.year].join('-');
  }

  /**
   * Validate that every referenced catalog row exists and that the effective
   * (make, model) pair is consistent. `makeId`/`modelId` fall back to the
   * current values so a partial PATCH that changes only one of them is still
   * checked against the other.
   */
  private async assertCatalogRefs(
    dto: Partial<CreateListingDto>,
    current?: Listing,
  ): Promise<void> {
    const makeId = dto.makeId ?? current?.makeId;
    const modelId = dto.modelId ?? current?.modelId;
    if (makeId && modelId) {
      const model = await this.models.findOne({ where: { id: modelId, makeId } });
      if (!model) {
        throw new NotFoundException('model does not belong to the given make');
      }
    }

    const dictChecks: Array<[string | undefined, Repository<{ id: string }>, string]> = [
      [dto.bodyTypeId, this.bodyTypes, 'bodyType'],
      [dto.fuelTypeId, this.fuelTypes, 'fuelType'],
      [dto.transmissionId, this.transmissions, 'transmission'],
      [dto.driveTypeId, this.driveTypes, 'driveType'],
      [dto.colorId, this.colors, 'color'],
    ];
    for (const [id, repo, name] of dictChecks) {
      if (id === undefined) continue;
      const exists = await repo.count({ where: { id } });
      if (!exists) throw new NotFoundException(`${name} not found`);
    }

    if (dto.optionIds?.length) {
      const found = await this.options.count({ where: { id: In(dto.optionIds) } });
      if (found !== new Set(dto.optionIds).size) {
        throw new NotFoundException('one or more options not found');
      }
    }
  }

  private async replaceOptions(
    em: EntityManager,
    listingId: string,
    optionIds: string[],
  ): Promise<void> {
    await em.delete(ListingOption, { listingId });
    if (!optionIds.length) return;
    const unique = Array.from(new Set(optionIds));
    await em
      .createQueryBuilder()
      .insert()
      .into(ListingOption)
      .values(unique.map((optionId) => ({ listingId, optionId })))
      .execute();
  }

  private async updateWithVersion(
    id: string,
    version: number,
    patch: Partial<Listing>,
    em?: EntityManager,
  ): Promise<void> {
    const qb = em ? em.createQueryBuilder() : this.listings.createQueryBuilder();
    const result = await qb
      .update(Listing)
      .set(patch)
      .where('id = :id', { id })
      .andWhere('version = :version', { version })
      .andWhere('deleted_at IS NULL')
      .execute();
    if (result.affected !== 1) {
      throw new ConflictException('Listing was modified by someone else');
    }
  }

  private sortMapping(sort: string): {
    orderKey: string;
    whereKey: string;
    direction: 'ASC' | 'DESC';
  } {
    switch (sort) {
      case 'price_asc':
        return { orderKey: 'l.priceNormalized', whereKey: 'l.price_normalized', direction: 'ASC' };
      case 'price_desc':
        return {
          orderKey: 'l.priceNormalized',
          whereKey: 'l.price_normalized',
          direction: 'DESC',
        };
      case 'year_asc':
        return { orderKey: 'l.year', whereKey: 'l.year', direction: 'ASC' };
      case 'year_desc':
        return { orderKey: 'l.year', whereKey: 'l.year', direction: 'DESC' };
      case 'mileage_asc':
        return { orderKey: 'l.mileageKm', whereKey: 'l.mileage_km', direction: 'ASC' };
      case 'newest':
      default:
        return { orderKey: 'l.publishedAt', whereKey: 'l.published_at', direction: 'DESC' };
    }
  }

  private cursorKeyOf(sort: string, listing: Listing): string {
    switch (sort) {
      case 'price_asc':
      case 'price_desc':
        return listing.priceNormalized;
      case 'year_asc':
      case 'year_desc':
        return String(listing.year);
      case 'mileage_asc':
        return String(listing.mileageKm);
      case 'newest':
      default:
        // findPublishedPage guarantees published_at IS NOT NULL — assert
        // defensively so a regression in the WHERE clause surfaces here, not
        // as a bogus empty-string cursor leaked to the client.
        if (!listing.publishedAt) {
          throw new Error(`Listing ${listing.id} has null published_at in public feed`);
        }
        return listing.publishedAt.toISOString();
    }
  }
}
