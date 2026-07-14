import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async record(entry: AuditEntry): Promise<void> {
    await this.repo.insert({
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
