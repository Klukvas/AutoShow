import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuditLogService } from '../audit/audit-log.service';
import {
  CreatePlacementPackageDto,
  UpdatePlacementPackageDto,
} from './dto/upsert-placement-package.dto';
import { PlacementPackage } from './entities/placement-package.entity';
import type { PlacementChannel } from './placement-channels';

/** Storefront shape — no publish flag, position or bookkeeping columns. */
export interface PublicPlacementPackage {
  id: string;
  title: string;
  description: string | null;
  priceUah: number;
  channels: PlacementChannel[];
  features: string[];
  isFeatured: boolean;
}

/** A homepage row of cards; more than this stops reading as a price list. */
const STOREFRONT_LIMIT = 8;

const CURATED_ORDER = { position: 'ASC', createdAt: 'ASC' } as const;

export function toPublicPackage(pkg: PlacementPackage): PublicPlacementPackage {
  return {
    id: pkg.id,
    title: pkg.title,
    description: pkg.description,
    priceUah: pkg.priceUah,
    channels: pkg.channels,
    features: pkg.features,
    isFeatured: pkg.isFeatured,
  };
}

@Injectable()
export class PlacementPackagesService {
  constructor(
    @InjectRepository(PlacementPackage) private readonly packages: Repository<PlacementPackage>,
    private readonly audit: AuditLogService,
  ) {}

  async listPublished(): Promise<PublicPlacementPackage[]> {
    const rows = await this.packages.find({
      where: { isPublished: true, deletedAt: IsNull() },
      order: CURATED_ORDER,
      take: STOREFRONT_LIMIT,
    });
    return rows.map(toPublicPackage);
  }

  /** A package a visitor may still pick: published and not deleted. */
  findPublished(id: string): Promise<PlacementPackage | null> {
    return this.packages.findOne({ where: { id, isPublished: true, deletedAt: IsNull() } });
  }

  listAll(): Promise<PlacementPackage[]> {
    return this.packages.find({ where: { deletedAt: IsNull() }, order: CURATED_ORDER });
  }

  async create(
    dto: CreatePlacementPackageDto,
    actor: AuthenticatedUser,
  ): Promise<PlacementPackage> {
    const saved = await this.packages.save(
      this.packages.create({
        title: dto.title,
        description: dto.description || null,
        priceUah: dto.priceUah,
        channels: dto.channels ?? [],
        features: dto.features ?? [],
        isFeatured: dto.isFeatured ?? false,
        isPublished: dto.isPublished ?? true,
        position: dto.position ?? 0,
      }),
    );
    await this.audit.record({
      action: 'placement_package.create',
      entityType: 'placement_package',
      entityId: saved.id,
      actorId: actor.id,
      actorRole: actor.role,
      diff: { title: saved.title, priceUah: saved.priceUah },
    });
    return saved;
  }

  async update(
    id: string,
    dto: UpdatePlacementPackageDto,
    actor: AuthenticatedUser,
  ): Promise<PlacementPackage> {
    const existing = await this.packages.findOne({ where: { id, deletedAt: IsNull() } });
    if (!existing) throw new NotFoundException('Placement package not found');
    const patch: Partial<PlacementPackage> = {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description || null }),
      ...(dto.priceUah !== undefined && { priceUah: dto.priceUah }),
      ...(dto.channels !== undefined && { channels: dto.channels }),
      ...(dto.features !== undefined && { features: dto.features }),
      ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
      ...(dto.isPublished !== undefined && { isPublished: dto.isPublished }),
      ...(dto.position !== undefined && { position: dto.position }),
    };
    const saved = await this.packages.save({ ...existing, ...patch });
    await this.audit.record({
      action: 'placement_package.update',
      entityType: 'placement_package',
      entityId: id,
      actorId: actor.id,
      actorRole: actor.role,
      diff: { patch },
    });
    return saved;
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const result = await this.packages.softDelete({ id, deletedAt: IsNull() });
    if (!result.affected) throw new NotFoundException('Placement package not found');
    await this.audit.record({
      action: 'placement_package.delete',
      entityType: 'placement_package',
      entityId: id,
      actorId: actor.id,
      actorRole: actor.role,
    });
  }
}
