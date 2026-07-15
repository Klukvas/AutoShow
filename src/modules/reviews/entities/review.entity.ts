import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base/base.entity';

/** Customer testimonial shown on the storefront homepage (admin-curated). */
@Entity('reviews')
@Index('ix_reviews_published_position', ['isPublished', 'position'])
export class Review extends BaseEntity {
  @Column({ name: 'author_name', type: 'varchar', length: 128 })
  authorName!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  city!: string | null;

  @Column({ type: 'text' })
  text!: string;

  /** 1..5 stars. */
  @Column({ type: 'int', default: 5 })
  rating!: number;

  @Column({ name: 'is_published', type: 'boolean', default: true })
  isPublished!: boolean;

  @Column({ type: 'int', default: 0 })
  position!: number;
}
