import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { isAiAccessPermitted } from '../ai-credentials/ai-access.policy';
import { AiCredentialsService } from '../ai-credentials/ai-credentials.service';
import { AdminUser } from '../admin-users/entities/admin-user.entity';
import { ListingAiSettings } from './entities/listing-ai-settings.entity';

export const LISTING_AI_ACCESS_DENIED =
  'Власник сайту не надав вам доступу до генерації описів ШІ.';
export const LISTING_AI_UNAVAILABLE = 'Генерація описів ШІ поки недоступна.';

/** The description feature's own switch and editor policy; the key is shared. */
@Injectable()
export class ListingAiAccessService {
  constructor(
    @InjectRepository(AdminUser) private readonly users: Repository<AdminUser>,
    @InjectRepository(ListingAiSettings) private readonly settings: Repository<ListingAiSettings>,
    private readonly credentials: AiCredentialsService,
  ) {}

  async permitted(actorId: string): Promise<boolean> {
    const actor = await this.users.findOne({
      where: { id: actorId, isActive: true, deletedAt: IsNull() },
      select: ['id', 'role'],
    });
    const policy =
      actor?.role === 'editor'
        ? await this.settings.findOne({
            where: { id: 1 },
            select: ['accessMode', 'selectedEditorIds'],
          })
        : null;
    return isAiAccessPermitted(actor, policy);
  }

  async requireAllowed(actorId: string): Promise<void> {
    if (!(await this.permitted(actorId))) throw new ForbiddenException(LISTING_AI_ACCESS_DENIED);
  }

  /** Switched on by the owner and a usable key exists. Fresh read on every paid call. */
  async available(): Promise<boolean> {
    const row = await this.settings.findOne({ where: { id: 1 }, select: ['enabled'] });
    if (!row?.enabled) return false;
    return (await this.credentials.state().catch(() => null))?.usable ?? false;
  }
}
