import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { catchUniqueViolation } from '../../common/db/conflict';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuditLogService } from '../audit/audit-log.service';
import { Listing } from '../listings/entities/listing.entity';
import { CatalogService } from './catalog.service';
import {
  UpsertColorDto,
  UpsertMakeDto,
  UpsertModelDto,
  UpsertOptionDto,
  UpsertSimpleCatalogDto,
} from './dto/upsert-catalog.dto';
import { BodyType } from './entities/body-type.entity';
import { Color } from './entities/color.entity';
import { DriveType } from './entities/drive-type.entity';
import { FuelType } from './entities/fuel-type.entity';
import { Make } from './entities/make.entity';
import { Model } from './entities/model.entity';
import { Transmission } from './entities/transmission.entity';
import { VehicleOption } from './entities/vehicle-option.entity';

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
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    private readonly catalog: CatalogService,
    private readonly audit: AuditLogService,
  ) {}

  /* makes / models */
  createMake(dto: UpsertMakeDto, actor: AuthenticatedUser) {
    return this.create(this.makes, dto, 'make', actor);
  }
  updateMake(id: string, dto: UpsertMakeDto, actor: AuthenticatedUser) {
    return this.update(this.makes, id, dto, 'make', actor);
  }
  async deleteMake(id: string, actor: AuthenticatedUser) {
    const [models, listings] = await Promise.all([
      this.models.count({ where: { makeId: id, deletedAt: IsNull() } }),
      this.listings.count({ where: { makeId: id, deletedAt: IsNull() } }),
    ]);
    if (models > 0 || listings > 0) {
      throw new ConflictException('make is in use by models or listings and cannot be deleted');
    }
    return this.softDelete(this.makes, id, 'make', actor);
  }
  createModel(dto: UpsertModelDto, actor: AuthenticatedUser) {
    return this.create(this.models, dto, 'model', actor);
  }
  updateModel(id: string, dto: UpsertModelDto, actor: AuthenticatedUser) {
    return this.update(this.models, id, dto, 'model', actor);
  }
  async deleteModel(id: string, actor: AuthenticatedUser) {
    const listings = await this.listings.count({ where: { modelId: id, deletedAt: IsNull() } });
    if (listings > 0) {
      throw new ConflictException('model is in use by listings and cannot be deleted');
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
  createColor(dto: UpsertColorDto, actor: AuthenticatedUser) {
    return this.create(this.colors, dto, 'color', actor);
  }
  createOption(dto: UpsertOptionDto, actor: AuthenticatedUser) {
    return this.create(this.options, dto, 'vehicle_option', actor);
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
    const saved = await (repo as Repository<T & { id: string }>).save({ ...found, ...dto });
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
