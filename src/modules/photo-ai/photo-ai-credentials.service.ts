import { PhotoAiAccessService, type PhotoAiAccessMode } from './photo-ai-access.service';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, Repository } from 'typeorm';
import type { AppConfig } from '../../config/config.module';
import { PhotoAiMode } from '../../config/env.validation';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuditLogService } from '../audit/audit-log.service';
import { PhotoAiSettings } from './entities/photo-ai-settings.entity';
import { decryptCredential, encryptCredential, encryptionKey } from './photo-ai-credential.crypto';
import type { UpdatePhotoAiSettingsDto } from './photo-ai-settings.dto';

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
export const MANAGED_KEY_REJECTED =
  'Ключ ШІ надає постачальник сайту — власний ключ не потрібен і не зберігається.';

@Injectable()
export class PhotoAiCredentialsService {
  constructor(
    @InjectRepository(PhotoAiSettings) private readonly repo: Repository<PhotoAiSettings>,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
    private readonly audit: AuditLogService,
    private readonly access: PhotoAiAccessService,
  ) {}
  private async read(em: EntityManager, lock = false): Promise<PhotoAiSettings> {
    const query = em
      .createQueryBuilder(PhotoAiSettings, 'settings')
      .addSelect('settings.encryptedKey')
      .where('settings.id = :id', { id: 1 });
    if (lock) query.setLock('pessimistic_write');
    const row = await query.getOne();
    if (!row) throw unavailable();
    return row;
  }
  private get isManaged(): boolean {
    return this.config.PHOTO_AI_MODE === PhotoAiMode.Managed;
  }
  /** Managed mode: the key comes from env; only enable + access policy are editable. */
  private managedMetadata(row: PhotoAiSettings): PhotoAiSettingsMetadata {
    return {
      mode: 'managed',
      accessMode: row.accessMode,
      selectedEditorIds: row.selectedEditorIds,
      configured: true,
      enabled: row.enabled,
      available: row.enabled,
      setupAvailable: true,
      revision: row.revision,
      status: row.enabled ? 'ready' : 'disabled',
    };
  }
  private metadataFor(row: PhotoAiSettings): PhotoAiSettingsMetadata {
    if (this.isManaged) return this.managedMetadata(row);
    const master = encryptionKey(this.config.PHOTO_AI_ENCRYPTION_KEY);
    const configured = Boolean(row.encryptedKey);
    const usable = Boolean(
      master && row.encryptedKey && decryptCredential(row.encryptedKey, master),
    );
    return {
      mode: 'own_key',
      accessMode: row.accessMode,
      selectedEditorIds: row.selectedEditorIds,
      configured,
      enabled: row.enabled,
      available: row.enabled && usable,
      setupAvailable: Boolean(master),
      revision: row.revision,
      status:
        !master || (configured && !usable)
          ? 'unavailable'
          : !configured
            ? 'not-configured'
            : row.enabled
              ? 'ready'
              : 'disabled',
    };
  }
  async metadata(): Promise<PhotoAiSettingsMetadata> {
    try {
      return this.metadataFor(await this.read(this.repo.manager));
    } catch {
      throw unavailable();
    }
  }
  /** Fresh lookup at each paid call. Never returns a credential to a controller. */
  async requireCredential(): Promise<string> {
    try {
      const row = await this.read(this.repo.manager);
      if (this.isManaged) {
        const managedKey = this.config.PHOTO_AI_MANAGED_API_KEY;
        if (!row.enabled || !managedKey) throw unavailable();
        return managedKey;
      }
      const master = encryptionKey(this.config.PHOTO_AI_ENCRYPTION_KEY);
      const credential =
        row.enabled && row.encryptedKey && master
          ? decryptCredential(row.encryptedKey, master)
          : null;
      if (!credential) throw unavailable();
      return credential;
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
    const key = dto.apiKey?.trim();
    if (this.isManaged && (key || dto.removeKey))
      throw new BadRequestException(MANAGED_KEY_REJECTED);
    if (dto.removeKey && key)
      throw new BadRequestException('Збереження та видалення ключа — окремі дії.');
    try {
      return await this.repo.manager.transaction(async (em) => {
        const row = await this.read(em, true);
        if (row.revision !== dto.expectedRevision)
          throw new ConflictException('Налаштування змінив інший користувач. Оновіть сторінку.');
        const master = encryptionKey(this.config.PHOTO_AI_ENCRYPTION_KEY);
        if (key && !master) throw unavailable();
        const encryptedKey = dto.removeKey
          ? null
          : key && master
            ? encryptCredential(key, master)
            : row.encryptedKey;
        const enabled = dto.removeKey ? false : (dto.enabled ?? row.enabled);
        if (
          !this.isManaged &&
          enabled &&
          (!master || !encryptedKey || !decryptCredential(encryptedKey, master))
        )
          throw new BadRequestException('Спочатку збережіть доступний ключ.');
        const accessMode = dto.accessMode ?? row.accessMode;
        const selectedEditorIds = dto.selectedEditorIds ?? row.selectedEditorIds;
        const next = {
          ...row,
          encryptedKey,
          enabled,
          accessMode,
          selectedEditorIds,
          revision: row.revision + 1,
        };
        await em.update(
          PhotoAiSettings,
          { id: 1 },
          { encryptedKey, enabled, accessMode, selectedEditorIds, revision: next.revision },
        );
        await this.audit.record(
          {
            action: 'photo_ai.settings.update',
            entityType: 'photo_ai_settings',
            actorId: actor.id,
            actorRole: actor.role,
            diff: {
              enabled,
              accessMode,
              selectedEditorIds,
              credentialAction: dto.removeKey ? 'removed' : key ? 'replaced' : 'unchanged',
            },
          },
          em,
        );
        return this.metadataFor(next);
      });
    } catch (error) {
      // Query failures can carry SQL parameter values. Do not send their raw
      // errors to the application's generic exception logger or HTTP responses.
      if (error instanceof HttpException) throw error;
      throw unavailable();
    }
  }
}
