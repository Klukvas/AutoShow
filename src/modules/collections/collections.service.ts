import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { catchUniqueViolation } from '../../common/db/conflict';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateCollectionDto, UpdateCollectionDto } from './dto/upsert-collection.dto';
import { Collection } from './entities/collection.entity';

@Injectable()
export class CollectionsService {
  constructor(
    @InjectRepository(Collection) private readonly repo: Repository<Collection>,
    private readonly audit: AuditLogService,
  ) {}

  /** Published collections for the storefront + sitemap, in curated order. */
  listPublished(): Promise<Collection[]> {
    return this.repo.find({
      where: { isPublished: true, deletedAt: IsNull() },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
  }

  async getPublishedByKey(key: string): Promise<Collection> {
    const found = await this.repo.findOne({
      where: { key, isPublished: true, deletedAt: IsNull() },
    });
    if (!found) throw new NotFoundException('Collection not found');
    return found;
  }

  /** All collections including unpublished — admin listing. */
  listAll(): Promise<Collection[]> {
    return this.repo.find({
      where: { deletedAt: IsNull() },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
  }

  async create(dto: CreateCollectionDto, actor: AuthenticatedUser): Promise<Collection> {
    const entity = this.repo.create({
      key: dto.key,
      emoji: dto.emoji ?? null,
      titleUk: dto.titleUk,
      descriptionUk: dto.descriptionUk ?? null,
      query: dto.query,
      position: dto.position ?? 0,
      isPublished: dto.isPublished ?? true,
    });
    const saved = await catchUniqueViolation(
      () => this.repo.save(entity),
      'A collection with this key already exists',
    );
    await this.audit.record({
      action: 'collection.create',
      entityType: 'collection',
      entityId: saved.id,
      diff: { key: saved.key },
      actorId: actor.id,
      actorRole: actor.role,
    });
    return saved;
  }

  async update(
    id: string,
    dto: UpdateCollectionDto,
    actor: AuthenticatedUser,
  ): Promise<Collection> {
    const current = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!current) throw new NotFoundException('Collection not found');
    const merged = this.repo.merge(current, {
      ...dto,
      emoji: dto.emoji !== undefined ? (dto.emoji ?? null) : current.emoji,
      descriptionUk:
        dto.descriptionUk !== undefined ? (dto.descriptionUk ?? null) : current.descriptionUk,
    });
    const saved = await catchUniqueViolation(
      () => this.repo.save(merged),
      'A collection with this key already exists',
    );
    await this.audit.record({
      action: 'collection.update',
      entityType: 'collection',
      entityId: id,
      // Before/after of the meaningful fields, not just the requested patch —
      // an omitted field means "unchanged", which the raw dto can't convey.
      diff: {
        from: { key: current.key, isPublished: current.isPublished, position: current.position },
        to: { key: saved.key, isPublished: saved.isPublished, position: saved.position },
        patch: dto,
      },
      actorId: actor.id,
      actorRole: actor.role,
    });
    return saved;
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const current = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!current) throw new NotFoundException('Collection not found');
    await this.repo.softRemove(current);
    await this.audit.record({
      action: 'collection.delete',
      entityType: 'collection',
      entityId: id,
      actorId: actor.id,
      actorRole: actor.role,
    });
  }
}
