import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base/base.entity';
import { Make } from './make.entity';

@Entity('catalog_models')
@Index('uq_catalog_models_make_slug_alive', ['makeId', 'slug'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index('ix_catalog_models_make', ['makeId'])
export class Model extends BaseEntity {
  @Column({ name: 'make_id', type: 'uuid' })
  makeId!: string;

  @ManyToOne(() => Make, (m) => m.models, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'make_id' })
  make?: Make;

  @Column({ name: 'name_uk', type: 'varchar', length: 128 })
  nameUk!: string;

  @Column({ name: 'name_en', type: 'varchar', length: 128, nullable: true })
  nameEn!: string | null;

  @Column({ type: 'varchar', length: 64 })
  slug!: string;
}
