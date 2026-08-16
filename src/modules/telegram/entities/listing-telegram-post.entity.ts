import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base/base.entity';
import { Listing } from '../../listings/entities/listing.entity';

/**
 * One row per (listing, channel) post. The unique partial index makes posting
 * idempotent: a retried/duplicate job sees the row and skips the channel.
 * `captionMessageId` is the album's first message — the only one carrying the
 * caption, and the one edited to «ПРОДАНО» on mark-sold.
 */
@Entity('listing_telegram_posts')
@Index('uq_listing_telegram_posts_listing_chat', ['listingId', 'chatId'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
export class ListingTelegramPost extends BaseEntity {
  @Column({ name: 'listing_id', type: 'uuid' })
  listingId!: string;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing?: Listing;

  @Column({ name: 'chat_id', type: 'varchar', length: 64 })
  chatId!: string;

  @Column({ name: 'message_ids', type: 'jsonb' })
  messageIds!: number[];

  @Column({ name: 'caption_message_id', type: 'int' })
  captionMessageId!: number;

  @Column({ name: 'sold_marked_at', type: 'timestamptz', nullable: true })
  soldMarkedAt!: Date | null;
}
