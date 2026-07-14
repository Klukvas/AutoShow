import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Audit log is append-only. No soft delete, no updated_at, no optimistic
 * locking — we don't extend BaseEntity.
 */
@Entity('audit_logs')
@Index('ix_audit_logs_created', ['createdAt', 'id'])
@Index('ix_audit_logs_entity', ['entityType', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null;

  @Column({ name: 'actor_role', type: 'varchar', length: 32, nullable: true })
  actorRole!: string | null;

  @Column({ type: 'varchar', length: 128 })
  action!: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 64 })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  diff!: Record<string, unknown> | null;

  @Column({ name: 'correlation_id', type: 'varchar', length: 64, nullable: true })
  correlationId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
