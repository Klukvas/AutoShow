import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../database/base/base.entity';
import { Listing } from './listing.entity';
import { MediaRendition } from './media-rendition.entity';

export type MediaType = 'image' | 'video';
export type MediaStatus = 'pending' | 'processing' | 'ready' | 'failed';

@Entity('listing_media')
@Index('ix_listing_media_listing_position', ['listingId', 'position'])
@Index('ix_listing_media_status', ['status'])
export class ListingMedia extends BaseEntity {
  @Column({ name: 'listing_id', type: 'uuid' })
  listingId!: string;

  @ManyToOne(() => Listing, (l) => l.media, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing?: Listing;

  @Column({
    type: 'varchar',
    length: 8,
  })
  type!: MediaType;

  @Column({ name: 'original_s3_key', type: 'varchar', length: 512 })
  originalS3Key!: string;

  @Column({
    type: 'varchar',
    length: 16,
    default: 'pending',
  })
  status!: MediaStatus;

  /* Filled by the worker after the upload — never trust the client for these. */

  @Column({ type: 'int', nullable: true })
  width!: number | null;

  @Column({ type: 'int', nullable: true })
  height!: number | null;

  @Column({ name: 'size_bytes', type: 'bigint', nullable: true })
  sizeBytes!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  mime!: string | null;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ name: 'is_cover', type: 'boolean', default: false })
  isCover!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  alt!: string | null;

  @Column({ name: 'failure_reason', type: 'varchar', length: 512, nullable: true })
  failureReason!: string | null;

  @OneToMany(() => MediaRendition, (r) => r.media, { cascade: true })
  renditions?: MediaRendition[];
}
