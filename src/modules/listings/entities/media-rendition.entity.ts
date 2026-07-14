import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base/base.entity';
import { ListingMedia } from './listing-media.entity';

export type RenditionVariant = 'thumb' | 'gallery' | 'full';
export type RenditionFormat = 'webp' | 'avif' | 'jpeg';

@Entity('media_renditions')
@Index('uq_media_renditions_media_variant_format', ['mediaId', 'variant', 'format'], {
  unique: true,
})
export class MediaRendition extends BaseEntity {
  @Column({ name: 'media_id', type: 'uuid' })
  mediaId!: string;

  @ManyToOne(() => ListingMedia, (m) => m.renditions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'media_id' })
  media?: ListingMedia;

  @Column({
    type: 'varchar',
    length: 16,
  })
  variant!: RenditionVariant;

  @Column({
    type: 'varchar',
    length: 8,
  })
  format!: RenditionFormat;

  @Column({ name: 's3_key', type: 'varchar', length: 512 })
  s3Key!: string;

  @Column({ type: 'int' })
  width!: number;

  @Column({ type: 'int' })
  height!: number;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes!: string;
}
