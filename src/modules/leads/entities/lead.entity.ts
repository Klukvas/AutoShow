import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base/base.entity';
import { Listing } from '../../listings/entities/listing.entity';

export type LeadType = 'callback' | 'message' | 'test_drive';
export type LeadStatus = 'new' | 'in_progress' | 'done' | 'spam';

interface Utm {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

@Entity('leads')
@Index('ix_leads_status_created', ['status', 'createdAt', 'id'])
@Index('ix_leads_created', ['createdAt', 'id'])
@Index('ix_leads_listing', ['listingId'])
export class Lead extends BaseEntity {
  @Column({ name: 'listing_id', type: 'uuid', nullable: true })
  listingId!: string | null;

  @ManyToOne(() => Listing, (l) => l.leads, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'listing_id' })
  listing?: Listing | null;

  @Column({
    type: 'varchar',
    length: 16,
  })
  type!: LeadType;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'varchar', length: 32 })
  phone!: string;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email!: string | null;

  @Column({ type: 'text', nullable: true })
  message!: string | null;

  @Column({
    type: 'varchar',
    length: 16,
    default: 'new',
  })
  status!: LeadStatus;

  @Column({ name: 'source_url', type: 'varchar', length: 1024, nullable: true })
  sourceUrl!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  utm!: Utm | null;

  @Column({ name: 'ip_hash', type: 'varchar', length: 64, nullable: true })
  ipHash!: string | null;
}
