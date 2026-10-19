import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base/base.entity';
import { Listing } from '../../listings/entities/listing.entity';
import type { ListingAiSnapshot } from '../listing-ai.input';
import type {
  ListingAiField,
  ListingAiPreset,
  ListingAiResult,
  ListingAiStatus,
  ListingAiValidation,
} from '../listing-ai.types';

/**
 * One AI draft for a listing's description and SEO fields. Rows are history:
 * the draft is copied into the listing form only when the owner accepts it.
 */
@Entity('listing_ai_generations')
@Index('ix_listing_ai_listing_created', ['listingId', 'createdAt'])
@Index('ix_listing_ai_actor_created', ['actorId', 'createdAt'])
export class ListingAiGeneration extends BaseEntity {
  @Column({ name: 'listing_id', type: 'uuid' }) listingId!: string;
  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing?: Listing;
  @Column({ name: 'actor_id', type: 'uuid' }) actorId!: string;
  @Column({ name: 'request_id', type: 'uuid' }) requestId!: string;
  @Column({ type: 'varchar', length: 16 }) preset!: ListingAiPreset;
  /** sha256 of the whitelisted input; drives idempotency and the "stale" mark. */
  @Column({ name: 'input_hash', type: 'varchar', length: 64 }) inputHash!: string;
  /**
   * Exactly what the model gets: the whitelisted listing data (no VIN, contacts
   * or commission) and the photo keys. Frozen at enqueue so the result matches
   * input_hash even if the listing changes while the draft is queued.
   */
  @Column({ name: 'input_snapshot', type: 'jsonb' }) inputSnapshot!: ListingAiSnapshot;
  @Column({ name: 'photo_media_ids', type: 'uuid', array: true, default: () => "'{}'::uuid[]" })
  photoMediaIds!: string[];
  @Column({ name: 'prompt_version', type: 'varchar', length: 32 }) promptVersion!: string;
  @Column({ type: 'varchar', length: 64 }) model!: string;
  @Column({ type: 'varchar', length: 20, default: 'queued' }) status!: ListingAiStatus;
  @Column({ name: 'failure_reason', type: 'varchar', length: 255, nullable: true })
  failureReason!: string | null;
  @Column({ type: 'jsonb', nullable: true }) result!: ListingAiResult | null;
  @Column({ type: 'jsonb', nullable: true }) validation!: ListingAiValidation | null;
  @Column({ name: 'input_tokens', type: 'integer', nullable: true }) inputTokens!: number | null;
  @Column({ name: 'output_tokens', type: 'integer', nullable: true }) outputTokens!: number | null;
  @Column({ name: 'cost_usd', type: 'numeric', precision: 10, scale: 6, nullable: true })
  costUsd!: string | null;
  @Column({ name: 'latency_ms', type: 'integer', nullable: true }) latencyMs!: number | null;
  @Column({ name: 'provider_started_at', type: 'timestamptz', nullable: true })
  providerStartedAt!: Date | null;
  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true }) acceptedAt!: Date | null;
  @Column({ name: 'accepted_by', type: 'uuid', nullable: true }) acceptedBy!: string | null;
  @Column({ name: 'accepted_fields', type: 'varchar', length: 24, array: true, nullable: true })
  acceptedFields!: ListingAiField[] | null;
}
