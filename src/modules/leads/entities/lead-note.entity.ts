import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Append-only note on a lead (the CRM touch history). No update/delete surface:
 * a note is an immutable record of what a teammate did/said, like an audit
 * entry. `author_id` is nullable (FK SET NULL) so a note survives its author
 * leaving the team.
 */
@Entity('lead_notes')
@Index('ix_lead_notes_lead', ['leadId', 'createdAt'])
export class LeadNote {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'lead_id', type: 'uuid' })
  leadId!: string;

  @Column({ name: 'author_id', type: 'uuid', nullable: true })
  authorId!: string | null;

  @Column({ name: 'author_role', type: 'varchar', length: 32, nullable: true })
  authorRole!: string | null;

  @Column({ type: 'text' })
  text!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
