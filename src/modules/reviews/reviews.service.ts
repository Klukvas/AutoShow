import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateReviewDto, UpdateReviewDto } from './dto/upsert-review.dto';
import { Review } from './entities/review.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    private readonly audit: AuditLogService,
  ) {}

  /** Storefront: published only, curated order. */
  listPublished(limit = 12): Promise<Review[]> {
    return this.reviews.find({
      where: { isPublished: true, deletedAt: IsNull() },
      order: { position: 'ASC', createdAt: 'DESC' },
      take: limit,
    });
  }

  listAll(): Promise<Review[]> {
    return this.reviews.find({
      where: { deletedAt: IsNull() },
      order: { position: 'ASC', createdAt: 'DESC' },
    });
  }

  async create(dto: CreateReviewDto, actor: AuthenticatedUser): Promise<Review> {
    const review = await this.reviews.save(
      this.reviews.create({
        authorName: dto.authorName,
        city: dto.city ?? null,
        text: dto.text,
        rating: dto.rating ?? 5,
        isPublished: dto.isPublished ?? true,
        position: dto.position ?? 0,
      }),
    );
    await this.audit.record({
      action: 'review.create',
      entityType: 'review',
      entityId: review.id,
      actorId: actor.id,
      actorRole: actor.role,
      diff: { authorName: dto.authorName },
    });
    return review;
  }

  async update(id: string, dto: UpdateReviewDto, actor: AuthenticatedUser): Promise<Review> {
    const review = await this.reviews.findOne({ where: { id, deletedAt: IsNull() } });
    if (!review) throw new NotFoundException('Review not found');
    const patch: Partial<Review> = {};
    if (dto.authorName !== undefined) patch.authorName = dto.authorName;
    if (dto.city !== undefined) patch.city = dto.city || null;
    if (dto.text !== undefined) patch.text = dto.text;
    if (dto.rating !== undefined) patch.rating = dto.rating;
    if (dto.isPublished !== undefined) patch.isPublished = dto.isPublished;
    if (dto.position !== undefined) patch.position = dto.position;
    const saved = await this.reviews.save({ ...review, ...patch });
    await this.audit.record({
      action: 'review.update',
      entityType: 'review',
      entityId: id,
      actorId: actor.id,
      actorRole: actor.role,
      diff: { patch },
    });
    return saved;
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const result = await this.reviews.softDelete({ id, deletedAt: IsNull() });
    if (!result.affected) throw new NotFoundException('Review not found');
    await this.audit.record({
      action: 'review.delete',
      entityType: 'review',
      entityId: id,
      actorId: actor.id,
      actorRole: actor.role,
    });
  }
}
