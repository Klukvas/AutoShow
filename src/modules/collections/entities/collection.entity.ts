import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base/base.entity';

/**
 * Filter preset behind a curated SEO landing page (/collections/:key). Mirrors
 * the public listings query params (a subset), stored as jsonb so new filters
 * need no schema change. Single source of truth for both the storefront and the
 * sitemap.
 */
export interface CollectionQuery {
  make?: string;
  model?: string;
  bodyType?: string;
  fuelType?: string;
  transmission?: string;
  driveType?: string;
  city?: string;
  condition?: 'new' | 'used' | 'damaged';
  priceMin?: number;
  priceMax?: number;
  yearMin?: number;
  yearMax?: number;
  mileageMax?: number;
}

@Entity('collections')
@Index('ix_collections_published_position', ['isPublished', 'position'])
@Index('uq_collections_key_alive', ['key'], { unique: true, where: 'deleted_at IS NULL' })
export class Collection extends BaseEntity {
  @Column({ type: 'varchar', length: 64 })
  key!: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  emoji!: string | null;

  @Column({ name: 'title_uk', type: 'varchar', length: 160 })
  titleUk!: string;

  @Column({ name: 'description_uk', type: 'varchar', length: 500, nullable: true })
  descriptionUk!: string | null;

  @Column({ type: 'jsonb', default: {} })
  query!: CollectionQuery;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ name: 'is_published', type: 'boolean', default: true })
  isPublished!: boolean;
}
