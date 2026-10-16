import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type PhotoAiLedgerType =
  | 'free_grant'
  | 'purchase'
  | 'refund'
  | 'reserve'
  | 'consume'
  | 'release';

/** Append-only history of the managed photo balance (one effect per row). */
@Entity('photo_ai_ledger')
@Index('ux_photo_ai_ledger_reserve', ['generationId'], {
  unique: true,
  where: `entry_type = 'reserve'`,
})
@Index('ux_photo_ai_ledger_settle', ['generationId'], {
  unique: true,
  where: `entry_type IN ('consume','release')`,
})
@Index('ux_photo_ai_ledger_purchase', ['invoiceId'], {
  unique: true,
  where: `entry_type = 'purchase'`,
})
@Index('ux_photo_ai_ledger_refund', ['invoiceId'], { unique: true, where: `entry_type = 'refund'` })
@Index('ux_photo_ai_ledger_free', ['entryType'], {
  unique: true,
  where: `entry_type = 'free_grant'`,
})
export class PhotoAiLedgerEntry {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'entry_type', type: 'varchar', length: 16 }) entryType!: PhotoAiLedgerType;
  @Column({ type: 'integer' }) photos!: number;
  @Column({ name: 'generation_id', type: 'uuid', nullable: true }) generationId!: string | null;
  @Column({ name: 'invoice_id', type: 'varchar', length: 64, nullable: true }) invoiceId!:
    | string
    | null;
  @Column({ name: 'actor_id', type: 'uuid', nullable: true }) actorId!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
