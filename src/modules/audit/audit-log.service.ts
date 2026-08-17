import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  diff?: Record<string, unknown> | null;
  correlationId?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  /**
   * Append an audit entry. Pass the caller's `em` to write it inside the same
   * transaction as the mutation — then a crash can't leave the change committed
   * without its audit row (or vice versa). Without `em` it writes standalone
   * (the post-commit best-effort path used by low-frequency mutations).
   */
  async record(entry: AuditEntry, em?: EntityManager): Promise<void> {
    const repo = em ? em.getRepository(AuditLog) : this.repo;
    await repo.insert({
      actorId: entry.actorId ?? null,
      actorRole: entry.actorRole ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      diff: (entry.diff ?? null) as never,
      correlationId: entry.correlationId ?? null,
    });
  }
}
