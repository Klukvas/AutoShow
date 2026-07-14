import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { VehicleOption } from '../../catalog/entities/vehicle-option.entity';
import { Listing } from './listing.entity';

/**
 * Join table for the facet filter — explicit entity so we can index by
 * option_id for `?options[]=leather&options[]=camera` filters.
 */
@Entity('listing_options')
@Index('ix_listing_options_option', ['optionId'])
export class ListingOption {
  @PrimaryColumn({ name: 'listing_id', type: 'uuid' })
  listingId!: string;

  @PrimaryColumn({ name: 'option_id', type: 'uuid' })
  optionId!: string;

  @ManyToOne(() => Listing, (l) => l.options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing?: Listing;

  @ManyToOne(() => VehicleOption, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'option_id' })
  option?: VehicleOption;
}
