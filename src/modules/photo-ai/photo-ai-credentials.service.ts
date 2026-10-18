import { PhotoAiAccessService, type PhotoAiAccessMode } from './photo-ai-access.service';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  AiCredentialsService,
  type AiCredentialChange,
  type AiCredentialState,
} from '../ai-credentials/ai-credentials.service';
import { AuditLogService } from '../audit/audit-log.service';
import { PhotoAiSettings } from './entities/photo-ai-settings.entity';
import type { UpdatePhotoAiSettingsDto } from './photo-ai-settings.dto';

export { MANAGED_KEY_REJECTED } from '../ai-credentials/ai-credentials.service';

export type PhotoAiSettingsMetadata = {
  /** own_key: the owner's stored key; managed: our key, photos sold in packs. */
  mode: 'own_key' | 'managed';
  accessMode: PhotoAiAccessMode;
  selectedEditorIds: string[];
  configured: boolean;
  enabled: boolean;
  available: boolean;
  setupAvailable: boolean;
  revision: number;
  status: 'ready' | 'disabled' | 'not-configured' | 'unavailable';
};
const unavailable = () => new ServiceUnavailableException('Налаштування ШІ поки недоступні.');

function credentialChange(dto: UpdatePhotoAiSettingsDto): AiCredentialChange {
  const apiKey = dto.apiKey?.trim();
  if (dto.removeKey && apiKey)
    throw new BadRequestException('Збереження та видалення ключа — окремі дії.');
  if (dto.removeKey) return { kind: 'remove' };
  return apiKey ? { kind: 'replace', apiKey } : { kind: 'keep' };
}

/**
 * Photo AI settings: the feature switch and access policy live here; the
 * provider key is owned by AiCredentialsService and only composed in.
 */
@Injectable()
export class PhotoAiCredentialsService {
  constructor(
    @InjectRepository(PhotoAiSettings) private readonly repo: Repository<PhotoAiSettings>,
    private readonly credentials: AiCredentialsService,
    private readonly audit: AuditLogService,
    private readonly access: PhotoAiAccessService,
  ) {}
  private async read(em: EntityManager, lock = false): Promise<PhotoAiSettings> {
    const query = em
      .createQueryBuilder(PhotoAiSettings, 'settings')
      .where('settings.id = :id', { id: 1 });
    if (lock) query.setLock('pessimistic_write');
    const row = await query.getOne();
    if (!row) throw unavailable();
    return row;
  }
  private metadataFor(row: PhotoAiSettings, key: AiCredentialState): PhotoAiSettingsMetadata {
    return {
      mode: key.mode,
      accessMode: row.accessMode,
      selectedEditorIds: row.selectedEditorIds,
      configured: key.configured,
      enabled: row.enabled,
      available: row.enabled && key.usable,
      setupAvailable: key.setupAvailable,
      revision: row.revision,
      status:
        !key.setupAvailable || (key.configured && !key.usable)
          ? 'unavailable'
          : !key.configured
            ? 'not-configured'
            : row.enabled
              ? 'ready'
              : 'disabled',
    };
  }
  async metadata(): Promise<PhotoAiSettingsMetadata> {
    try {
      const em = this.repo.manager;
      return this.metadataFor(await this.read(em), await this.credentials.state(em));
    } catch {
      throw unavailable();
    }
  }
  /** Fresh lookup at each paid call. Never returns a credential to a controller. */
  async requireCredential(): Promise<string> {
    try {
      if (!(await this.read(this.repo.manager)).enabled) throw unavailable();
      return await this.credentials.requireApiKey();
    } catch {
      throw unavailable();
    }
  }
  async update(
    dto: UpdatePhotoAiSettingsDto,
    actor: AuthenticatedUser,
  ): Promise<PhotoAiSettingsMetadata> {
    await this.access.requireAdmin(actor.id);
    if (dto.selectedEditorIds !== undefined)
      await this.access.validateSelected(dto.selectedEditorIds);
    const change = credentialChange(dto);
    this.credentials.assertChangeAllowed(change);
    try {
      return await this.repo.manager.transaction(async (em) => {
        // Settings row first, then the key row: the lock order every AI settings save uses.
        const row = await this.read(em, true);
        if (row.revision !== dto.expectedRevision)
          throw new ConflictException('Налаштування змінив інший користувач. Оновіть сторінку.');
        const { state: key, action } = await this.credentials.apply(em, change);
        const enabled = change.kind === 'remove' ? false : (dto.enabled ?? row.enabled);
        if (key.mode === 'own_key' && enabled && !key.usable)
          throw new BadRequestException('Спочатку збережіть доступний ключ.');
        const accessMode = dto.accessMode ?? row.accessMode;
        const selectedEditorIds = dto.selectedEditorIds ?? row.selectedEditorIds;
        const next = { ...row, enabled, accessMode, selectedEditorIds, revision: row.revision + 1 };
        await em.update(
          PhotoAiSettings,
          { id: 1 },
          { enabled, accessMode, selectedEditorIds, revision: next.revision },
        );
        await this.audit.record(
          {
            action: 'photo_ai.settings.update',
            entityType: 'photo_ai_settings',
            actorId: actor.id,
            actorRole: actor.role,
            diff: { enabled, accessMode, selectedEditorIds, credentialAction: action },
          },
          em,
        );
        return this.metadataFor(next, key);
      });
    } catch (error) {
      // Query failures can carry SQL parameter values. Do not send their raw
      // errors to the application's generic exception logger or HTTP responses.
      if (error instanceof HttpException) throw error;
      throw unavailable();
    }
  }
}
