import { StorageService } from '../storage/storage.service';
import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { IsNull, Repository } from 'typeorm';
import { catchUniqueViolation } from '../../common/db/conflict';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { MAINTENANCE_QUEUE } from '../../workers/queue.tokens';
import { AuditLogService } from '../audit/audit-log.service';
import { Listing } from '../listings/entities/listing.entity';
import { CatalogService } from './catalog.service';
import {
  UpsertColorDto,
  UpsertMakeDto,
  UpsertModelDto,
  UpsertOptionDto,
  UpsertSimpleCatalogDto,
  UpsertTagDto,
} from './dto/upsert-catalog.dto';
import { BodyType } from './entities/body-type.entity';
import { Color } from './entities/color.entity';
import { DriveType } from './entities/drive-type.entity';
import { FuelType } from './entities/fuel-type.entity';
import { Make } from './entities/make.entity';
import { Model } from './entities/model.entity';
import { Transmission } from './entities/transmission.entity';
import { VehicleOption } from './entities/vehicle-option.entity';
import { Tag } from './entities/tag.entity';
import { ListingTag } from '../listings/entities/listing-tag.entity';
import { firstFreeSlug, ukSlug } from './uk-slug';

const FALLBACK_COLOR_SLUG = 'color';

const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('uk');

function findColorByName(colors: readonly Color[], name: string): Color | undefined {
  const wanted = normalizeName(name);
  return colors.find((color) => normalizeName(color.nameUk) === wanted);
}

@Injectable()
export class CatalogAdminService {
  constructor(
    @InjectRepository(Make) private readonly makes: Repository<Make>,
    @InjectRepository(Model) private readonly models: Repository<Model>,
    @InjectRepository(BodyType) private readonly bodies: Repository<BodyType>,
    @InjectRepository(FuelType) private readonly fuels: Repository<FuelType>,
    @InjectRepository(Transmission)
    private readonly transmissions: Repository<Transmission>,
    @InjectRepository(DriveType) private readonly drives: Repository<DriveType>,
    @InjectRepository(Color) private readonly colors: Repository<Color>,
    @InjectRepository(VehicleOption)
    private readonly options: Repository<VehicleOption>,
    @InjectRepository(Tag) private readonly tags: Repository<Tag>,
    @InjectRepository(ListingTag)
    private readonly listingTags: Repository<ListingTag>,
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    private readonly catalog: CatalogService,
    private readonly audit: AuditLogService,
    @InjectQueue(MAINTENANCE_QUEUE) private readonly maintenance: Queue,
    private readonly storage: StorageService,
  ) {}

  private readonly logger = new Logger(CatalogAdminService.name);

  /* makes / models */
  async listMakes() {
    const makes = await this.makes
      .createQueryBuilder('make')
      .loadRelationCountAndMap('make.modelCount', 'make.models', 'model', (qb) =>
        qb.andWhere('model.deleted_at IS NULL'),
      )
      .orderBy('make.name_uk', 'ASC')
      .getMany();
    return makes.map((make) => this.makeView(make));
  }
  async listModels(makeId?: string) {
    if (makeId) await this.requireMake(makeId);
    return this.models.find({ where: makeId ? { makeId } : {}, order: { nameUk: 'ASC' } });
  }
  private makeView(make: Make & { modelCount?: number }) {
    return {
      id: make.id,
      slug: make.slug,
      nameUk: make.nameUk,
      nameEn: make.nameEn,
      logoUrl: make.logoS3Key ? this.storage.publicUrlFor(make.logoS3Key) : null,
      modelCount: make.modelCount ?? 0,
    };
  }
  private async requireMake(id: string) {
    const make = await this.makes.findOne({ where: { id, deletedAt: IsNull() } });
    if (!make) throw new NotFoundException('Марку не знайдено');
    return make;
  }

  async createMake(dto: UpsertMakeDto, actor: AuthenticatedUser) {
    const saved = await this.create(this.makes, dto, 'make', actor);
    // Logo fetch is best-effort background work — a queue hiccup must not
    // fail make creation (the weekly sweep will pick the make up anyway).
    try {
      await this.maintenance.add(
        'make-logo',
        { makeId: (saved as Make).id },
        { attempts: 3, backoff: { type: 'exponential', delay: 10_000 }, removeOnComplete: 1_000 },
      );
    } catch (err) {
      this.logger.warn({ err, makeId: (saved as Make).id }, 'failed to enqueue make logo fetch');
    }
    return this.makeView(saved as Make);
  }
  async updateMake(id: string, dto: UpsertMakeDto, actor: AuthenticatedUser) {
    await this.update(this.makes, id, dto, 'make', actor);
    return this.makeView(await this.requireMake(id));
  }
  async deleteMake(id: string, actor: AuthenticatedUser) {
    // Catalog model creation takes the same parent lock, so a model cannot
    // appear between the reference check and the make's soft deletion.
    await this.makes.manager.transaction(async (manager) => {
      const makes = manager.getRepository(Make);
      const make = await makes.findOne({
        where: { id, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!make) throw new NotFoundException('Марку не знайдено');
      const [models, listings] = await Promise.all([
        manager.getRepository(Model).count({ where: { makeId: id, deletedAt: IsNull() } }),
        manager.getRepository(Listing).count({ where: { makeId: id, deletedAt: IsNull() } }),
      ]);
      if (models > 0 || listings > 0)
        throw new ConflictException(
          'Марка використовується моделями або оголошеннями. Спочатку приберіть зв’язки',
        );
      await makes.softDelete(id);
    });
    await this.catalog.invalidate();
    await this.audit.record({
      action: 'catalog.make.delete',
      entityType: 'make',
      entityId: id,
      actorId: actor.id,
      actorRole: actor.role,
    });
  }
  async createModel(dto: UpsertModelDto, actor: AuthenticatedUser) {
    const saved = await this.makes.manager.transaction(async (manager) => {
      const make = await manager.getRepository(Make).findOne({
        where: { id: dto.makeId, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!make) throw new NotFoundException('Марку не знайдено');
      const models = manager.getRepository(Model);
      return catchUniqueViolation(
        () => models.save(models.create(dto)),
        'Модель із такою назвою вже існує',
      );
    });
    await this.catalog.invalidate();
    await this.audit.record({
      action: 'catalog.model.create',
      entityType: 'model',
      entityId: saved.id,
      diff: { ...dto },
      actorId: actor.id,
      actorRole: actor.role,
    });
    return saved;
  }
  async updateModel(id: string, dto: UpsertModelDto, actor: AuthenticatedUser) {
    await this.requireMake(dto.makeId);
    const model = await this.models.findOne({ where: { id, deletedAt: IsNull() } });
    if (!model) throw new NotFoundException('Модель не знайдено');
    if (model.makeId !== dto.makeId)
      throw new BadRequestException('Марку моделі змінити неможливо');
    return this.update(this.models, id, dto, 'model', actor);
  }
  async deleteModel(id: string, actor: AuthenticatedUser) {
    const listings = await this.listings.count({ where: { modelId: id, deletedAt: IsNull() } });
    if (listings > 0) {
      throw new ConflictException(
        'Модель використовується оголошеннями. Спочатку приберіть зв’язки',
      );
    }
    return this.softDelete(this.models, id, 'model', actor);
  }

  /* simple catalogs */
  createBodyType(dto: UpsertSimpleCatalogDto, actor: AuthenticatedUser) {
    return this.create(this.bodies, dto, 'body_type', actor);
  }
  createFuelType(dto: UpsertSimpleCatalogDto, actor: AuthenticatedUser) {
    return this.create(this.fuels, dto, 'fuel_type', actor);
  }
  createTransmission(dto: UpsertSimpleCatalogDto, actor: AuthenticatedUser) {
    return this.create(this.transmissions, dto, 'transmission', actor);
  }
  createDriveType(dto: UpsertSimpleCatalogDto, actor: AuthenticatedUser) {
    return this.create(this.drives, dto, 'drive_type', actor);
  }
  /**
   * Idempotent by name: an alive color with the same name (case/space
   * insensitive) is returned as is, so a double submit or two editors typing
   * «бежевий» never produce duplicate options.
   */
  async createColor(dto: UpsertColorDto, actor: AuthenticatedUser): Promise<Color> {
    const nameUk = dto.nameUk.trim();
    const alive = await this.colors.find();
    const sameName = findColorByName(alive, nameUk);
    if (sameName) return sameName;
    const slug =
      dto.slug ??
      firstFreeSlug(ukSlug(nameUk) || FALLBACK_COLOR_SLUG, new Set(alive.map((c) => c.slug)));
    try {
      return await this.create(this.colors, { ...dto, nameUk, slug }, 'color', actor);
    } catch (err) {
      // A concurrent request may have created the very same color first.
      if (err instanceof ConflictException) {
        const raced = findColorByName(await this.colors.find(), nameUk);
        if (raced) return raced;
      }
      throw err;
    }
  }
  createOption(dto: UpsertOptionDto, actor: AuthenticatedUser) {
    return this.create(this.options, dto, 'vehicle_option', actor);
  }

  /* tags */
  listTags() {
    // Admin management view: ALL tags, including unpublished/staged ones (the
    // public list in CatalogService returns published only).
    return this.tags.find({ order: { position: 'ASC', nameUk: 'ASC' } });
  }
  createTag(dto: UpsertTagDto, actor: AuthenticatedUser) {
    return this.create(this.tags, dto, 'tag', actor);
  }
  updateTag(id: string, dto: UpsertTagDto, actor: AuthenticatedUser) {
    return this.update(this.tags, id, dto, 'tag', actor);
  }
  async deleteTag(id: string, actor: AuthenticatedUser) {
    // A soft-delete would orphan the RESTRICT join rows (still shown as badges),
    // so block deletion while the tag is attached — same guard as deleteMake.
    const inUse = await this.listingTags.count({ where: { tagId: id } });
    if (inUse > 0) {
      throw new ConflictException('tag is in use by listings and cannot be deleted');
    }
    return this.softDelete(this.tags, id, 'tag', actor);
  }

  private async create<T extends { id?: string }>(
    repo: Repository<T>,
    dto: Partial<T>,
    type: string,
    actor: AuthenticatedUser,
  ) {
    const entity = repo.create(dto as T);
    const saved = await catchUniqueViolation(
      () => repo.save(entity),
      `${type} with this slug already exists`,
    );
    await this.catalog.invalidate();
    await this.audit.record({
      action: `catalog.${type}.create`,
      entityType: type,
      entityId: (saved as { id: string }).id,
      diff: { ...dto },
      actorId: actor.id,
      actorRole: actor.role,
    });
    return saved;
  }

  private async update<T extends { id?: string }>(
    repo: Repository<T>,
    id: string,
    dto: Partial<T>,
    type: string,
    actor: AuthenticatedUser,
  ) {
    const found = await (repo as Repository<T & { id: string }>).findOne({
      where: { id } as Parameters<Repository<T & { id: string }>['findOne']>[0]['where'],
    });
    if (!found) throw new NotFoundException(`${type} not found`);
    // Narrow updates cannot restore a stale logo while a file is being uploaded.
    await catchUniqueViolation(
      () => repo.update(id, dto as Parameters<Repository<T>['update']>[1]),
      `${type} with this slug already exists`,
    );
    const saved = { ...found, ...dto };
    await this.catalog.invalidate();
    await this.audit.record({
      action: `catalog.${type}.update`,
      entityType: type,
      entityId: id,
      diff: { ...dto },
      actorId: actor.id,
      actorRole: actor.role,
    });
    return saved;
  }

  private async softDelete<T extends { id?: string }>(
    repo: Repository<T>,
    id: string,
    type: string,
    actor: AuthenticatedUser,
  ) {
    const result = await repo.softDelete(id);
    if (!result.affected) throw new NotFoundException(`${type} not found`);
    await this.catalog.invalidate();
    await this.audit.record({
      action: `catalog.${type}.delete`,
      entityType: type,
      entityId: id,
      actorId: actor.id,
      actorRole: actor.role,
    });
  }
}
