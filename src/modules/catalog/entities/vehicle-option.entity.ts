import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base/base.entity';

export type VehicleOptionCategory =
  | 'comfort'
  | 'safety'
  | 'multimedia'
  | 'interior'
  | 'exterior'
  | 'other';

@Entity('catalog_vehicle_options')
@Index('uq_catalog_vehicle_options_slug_alive', ['slug'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index('ix_catalog_vehicle_options_category', ['category'])
export class VehicleOption extends BaseEntity {
  @Column({ type: 'varchar', length: 32 })
  category!: VehicleOptionCategory;

  @Column({ name: 'name_uk', type: 'varchar', length: 128 })
  nameUk!: string;

  @Column({ name: 'name_en', type: 'varchar', length: 128, nullable: true })
  nameEn!: string | null;

  @Column({ type: 'varchar', length: 64 })
  slug!: string;
}
