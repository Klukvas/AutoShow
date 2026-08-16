import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../database/base/base.entity';
import { Model } from './model.entity';

@Entity('catalog_makes')
@Index('uq_catalog_makes_slug_alive', ['slug'], { unique: true, where: '"deleted_at" IS NULL' })
export class Make extends BaseEntity {
  @Column({ name: 'name_uk', type: 'varchar', length: 128 })
  nameUk!: string;

  @Column({ name: 'name_en', type: 'varchar', length: 128, nullable: true })
  nameEn!: string | null;

  @Column({ type: 'varchar', length: 64 })
  slug!: string;

  /* Manufacturer logo, auto-fetched from Wikipedia into our S3.
   * logoCheckedAt marks the last fetch ATTEMPT (success or miss) so the
   * maintenance sweep doesn't hammer Wikipedia for makes without a page. */

  @Column({ name: 'logo_s3_key', type: 'varchar', length: 512, nullable: true })
  logoS3Key!: string | null;

  @Column({ name: 'logo_checked_at', type: 'timestamptz', nullable: true })
  logoCheckedAt!: Date | null;

  @OneToMany(() => Model, (m) => m.make)
  models?: Model[];
}
