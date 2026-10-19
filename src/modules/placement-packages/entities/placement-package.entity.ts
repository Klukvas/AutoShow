import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base/base.entity';
import type { PlacementChannel } from '../placement-channels';

/**
 * Paid placement tariff ("Instagram post — 100 грн") shown on the storefront
 * homepage. Admin-curated: the salon creates its own packages; the migration
 * only ships a few hidden starter templates.
 */
@Entity('placement_packages')
@Index('ix_placement_packages_published_position', ['isPublished', 'position'])
export class PlacementPackage extends BaseEntity {
  @Column({ type: 'varchar', length: 80 })
  title!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  /** Whole hryvnias — placement is sold locally, so no multi-currency. */
  @Column({ name: 'price_uah', type: 'int' })
  priceUah!: number;

  @Column({ type: 'varchar', length: 24, array: true, default: () => "'{}'" })
  channels!: PlacementChannel[];

  /** "What's included" bullets, in display order. */
  @Column({ type: 'varchar', length: 120, array: true, default: () => "'{}'" })
  features!: string[];

  /** Highlighted card ("Популярний"). */
  @Column({ name: 'is_featured', type: 'boolean', default: false })
  isFeatured!: boolean;

  @Column({ name: 'is_published', type: 'boolean', default: true })
  isPublished!: boolean;

  @Column({ type: 'int', default: 0 })
  position!: number;
}
