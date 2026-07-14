import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base/base.entity';

@Entity('catalog_transmissions')
@Index('uq_catalog_transmissions_slug_alive', ['slug'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class Transmission extends BaseEntity {
  @Column({ name: 'name_uk', type: 'varchar', length: 64 })
  nameUk!: string;

  @Column({ name: 'name_en', type: 'varchar', length: 64, nullable: true })
  nameEn!: string | null;

  @Column({ type: 'varchar', length: 64 })
  slug!: string;
}
