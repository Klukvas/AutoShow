import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { requireActiveAdmin, validateSelectedEditors } from '../ai-credentials/ai-access.staff';
import { AiCredentialsService } from '../ai-credentials/ai-credentials.service';
import { AdminUser } from '../admin-users/entities/admin-user.entity';
import { AuditLogService } from '../audit/audit-log.service';
import { ListingAiSettings } from './entities/listing-ai-settings.entity';
import type { ListingAiAccessMode } from './listing-ai.types';

export type ListingAiSettingsView = {
  enabled: boolean;
  accessMode: ListingAiAccessMode;
  selectedEditorIds: string[];
  revision: number;
  /** A usable AI key exists (it is managed in the photo AI settings for now). */
  keyUsable: boolean;
  /** Switched on and a key is usable. */
  available: boolean;
};

export type UpdateListingAiSettings = {
  expectedRevision: number;
  enabled?: boolean;
  accessMode?: ListingAiAccessMode;
  selectedEditorIds?: string[];
};

const unavailable = () => new ServiceUnavailableException('Налаштування ШІ поки недоступні.');

/** Owner-only switch and editor policy of AI descriptions. */
@Injectable()
export class ListingAiSettingsService {
  private readonly logger = new Logger(ListingAiSettingsService.name);

  constructor(
    @InjectRepository(ListingAiSettings) private readonly settings: Repository<ListingAiSettings>,
    @InjectRepository(AdminUser) private readonly users: Repository<AdminUser>,
    private readonly credentials: AiCredentialsService,
    private readonly audit: AuditLogService,
  ) {}

  private async read(em: EntityManager, lock = false): Promise<ListingAiSettings> {
    const row = await em.findOne(ListingAiSettings, {
      where: { id: 1 },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!row) throw unavailable();
    return row;
  }

  private async view(row: ListingAiSettings): Promise<ListingAiSettingsView> {
    const keyUsable = (await this.credentials.state().catch(() => null))?.usable ?? false;
    return {
      enabled: row.enabled,
      accessMode: row.accessMode,
      selectedEditorIds: row.selectedEditorIds,
      revision: row.revision,
      keyUsable,
      available: row.enabled && keyUsable,
    };
  }

  async get(actor: AuthenticatedUser): Promise<ListingAiSettingsView> {
    await requireActiveAdmin(this.users, actor.id);
    return this.view(await this.read(this.settings.manager));
  }

  async update(
    dto: UpdateListingAiSettings,
    actor: AuthenticatedUser,
  ): Promise<ListingAiSettingsView> {
    await requireActiveAdmin(this.users, actor.id);
    if (dto.selectedEditorIds !== undefined)
      await validateSelectedEditors(this.users, dto.selectedEditorIds);
    if (dto.enabled && !(await this.credentials.state().catch(() => null))?.usable)
      throw new BadRequestException(
        'Спочатку збережіть доступний ключ ШІ в налаштуваннях обробки фото.',
      );
    try {
      const next = await this.settings.manager.transaction(async (em) => {
        const row = await this.read(em, true);
        if (row.revision !== dto.expectedRevision)
          throw new ConflictException('Налаштування змінив інший користувач. Оновіть сторінку.');
        const patch = {
          enabled: dto.enabled ?? row.enabled,
          accessMode: dto.accessMode ?? row.accessMode,
          selectedEditorIds: dto.selectedEditorIds ?? row.selectedEditorIds,
          revision: row.revision + 1,
        };
        await em.update(ListingAiSettings, { id: 1 }, patch);
        await this.audit.record(
          {
            action: 'listing_ai.settings.update',
            entityType: 'listing_ai_settings',
            actorId: actor.id,
            actorRole: actor.role,
            diff: {
              enabled: patch.enabled,
              accessMode: patch.accessMode,
              selectedEditorIds: patch.selectedEditorIds,
            },
          },
          em,
        );
        return { ...row, ...patch };
      });
      return this.view(next);
    } catch (error) {
      // Query failures can carry parameter values: never pass raw DB errors on.
      if (error instanceof HttpException) throw error;
      this.logger.error(
        { actorId: actor.id, reason: error instanceof Error ? error.name : 'unknown' },
        'listing AI settings update failed',
      );
      throw unavailable();
    }
  }
}
