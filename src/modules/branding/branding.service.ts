import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuditLogService } from '../audit/audit-log.service';
import { SiteSettings } from './entities/site-settings.entity';

@Injectable()
export class BrandingService {
  constructor(
    @InjectRepository(SiteSettings)
    private readonly repo: Repository<SiteSettings>,
    private readonly audit: AuditLogService,
  ) {}

  async getCurrent(): Promise<SiteSettings> {
    const settings = await this.repo.findOne({ where: { deletedAt: IsNull() } });
    if (!settings) throw new NotFoundException('Site settings not configured');
    return settings;
  }

  async update(patch: Partial<SiteSettings>, actor: AuthenticatedUser): Promise<SiteSettings> {
    const current = await this.getCurrent();
    const saved = await this.repo.save({ ...current, ...patch });
    await this.audit.record({
      action: 'branding.update',
      entityType: 'site_settings',
      entityId: saved.id,
      diff: { patch },
      actorId: actor.id,
      actorRole: actor.role,
    });
    return saved;
  }
}
