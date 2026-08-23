import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Tag } from '../../catalog/entities/tag.entity';
import { Listing } from './listing.entity';

/**
 * Join table for listing tags — explicit entity so we can index by tag_id for
 * `?tags[]=obmin&tags[]=urgent` filters, mirroring ListingOption.
 */
@Entity('listing_tags')
@Index('ix_listing_tags_tag', ['tagId'])
export class ListingTag {
  @PrimaryColumn({ name: 'listing_id', type: 'uuid' })
  listingId!: string;

  @PrimaryColumn({ name: 'tag_id', type: 'uuid' })
  tagId!: string;

  @ManyToOne(() => Listing, (l) => l.tags, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing?: Listing;

  @ManyToOne(() => Tag, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tag_id' })
  tag?: Tag;
}
