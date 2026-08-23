import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base/base.entity';

/**
 * A curated marketing/deal label (e.g. "обмін", "терміновий продаж"). Unlike a
 * vehicle option it describes the offer, not the car. Single visual style on
 * the storefront — no per-tag colour/emoji by design. `isPublished` hides a tag
 * from the storefront (filter list + badges) without deleting it.
 */
@Entity('catalog_tags')
@Index('uq_catalog_tags_slug_alive', ['slug'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index('ix_catalog_tags_published_position', ['isPublished', 'position'])
export class Tag extends BaseEntity {
  @Column({ name: 'name_uk', type: 'varchar', length: 64 })
  nameUk!: string;

  @Column({ name: 'name_en', type: 'varchar', length: 64, nullable: true })
  nameEn!: string | null;

  @Column({ type: 'varchar', length: 64 })
  slug!: string;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ name: 'is_published', type: 'boolean', default: true })
  isPublished!: boolean;
}
