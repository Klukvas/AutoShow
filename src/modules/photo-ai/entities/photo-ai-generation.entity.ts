import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base/base.entity';
import { ListingMedia } from '../../listings/entities/listing-media.entity';
import type { PhotoAiCategory, PhotoAiManifest, PhotoAiStatus } from '../photo-ai.types';

@Entity('photo_ai_generations')
@Index('ix_photo_ai_media_created', ['mediaId', 'createdAt'])
export class PhotoAiGeneration extends BaseEntity {
  @Column({ name: 'media_id', type: 'uuid' }) mediaId!: string;
  @ManyToOne(() => ListingMedia, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'media_id' })
  media?: ListingMedia;
  @Column({ name: 'listing_id', type: 'uuid' }) listingId!: string;
  @Column({ name: 'actor_id', type: 'uuid' }) actorId!: string;
  @Column({ name: 'request_id', type: 'uuid' }) requestId!: string;
  @Column({ type: 'varchar', length: 64 }) fingerprint!: string;
  @Column({ type: 'varchar', length: 12 }) category!: PhotoAiCategory;
  /** Builtin preset id; the preset text itself lives only in effectivePrompt. */
  @Column({ name: 'preset_id', type: 'varchar', length: 32, nullable: true }) presetId!:
    | string
    | null;
  /** What the owner typed (their own instruction, or wishes added to a preset). */
  @Column({ type: 'text' }) prompt!: string;
  @Column({ name: 'effective_prompt', type: 'text' }) effectivePrompt!: string;
  @Column({ name: 'source_s3_key', type: 'varchar', length: 512 }) sourceS3Key!: string;
  @Column({ type: 'varchar', length: 20, default: 'queued' }) status!: PhotoAiStatus;
  @Column({ name: 'failure_reason', type: 'varchar', length: 255, nullable: true }) failureReason!:
    | string
    | null;
  @Column({ name: 'provider_started_at', type: 'timestamptz', nullable: true })
  providerStartedAt!: Date | null;
  @Column({ name: 'output_stored_at', type: 'timestamptz', nullable: true })
  outputStoredAt!: Date | null;
  @Column({ name: 'artifacts_cleaned_at', type: 'timestamptz', nullable: true })
  artifactsCleanedAt!: Date | null;
  @Column({ type: 'jsonb', nullable: true }) manifest!: PhotoAiManifest | null;
}
