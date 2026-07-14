import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base/base.entity';

@Entity('catalog_colors')
@Index('uq_catalog_colors_slug_alive', ['slug'], { unique: true, where: '"deleted_at" IS NULL' })
export class Color extends BaseEntity {
  @Column({ name: 'name_uk', type: 'varchar', length: 64 })
  nameUk!: string;

  @Column({ name: 'name_en', type: 'varchar', length: 64, nullable: true })
  nameEn!: string | null;

  @Column({ type: 'varchar', length: 64 })
  slug!: string;

  @Column({ name: 'hex', type: 'varchar', length: 9, nullable: true })
  hex!: string | null;
}
