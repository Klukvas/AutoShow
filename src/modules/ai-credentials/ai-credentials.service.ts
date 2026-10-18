import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import type { AppConfig } from '../../config/config.module';
import { PhotoAiMode } from '../../config/env.validation';
import { decryptCredential, encryptCredential, encryptionKey } from './ai-credential.crypto';
import { AiCredentials } from './entities/ai-credentials.entity';

export type AiCredentialMode = 'own_key' | 'managed';
export type AiCredentialState = {
  /** own_key: the owner's stored key; managed: the provider's key from env. */
  mode: AiCredentialMode;
  configured: boolean;
  usable: boolean;
  /** False when a key could not be stored or read (no valid master key). */
  setupAvailable: boolean;
};
export type AiCredentialChange =
  | { kind: 'keep' }
  | { kind: 'replace'; apiKey: string }
  | { kind: 'remove' };
export type AiCredentialAction = 'replaced' | 'removed' | 'unchanged';

export const MANAGED_KEY_REJECTED =
  'Ключ ШІ надає постачальник сайту — власний ключ не потрібен і не зберігається.';
const unavailable = () => new ServiceUnavailableException('Налаштування ШІ поки недоступні.');

/**
 * Owns the AI provider key: storage, encryption and the own_key/managed
 * switch. Feature modules keep their own enable flags and access policies and
 * ask here only for the key. The env names keep their historical PHOTO_AI_
 * prefix so existing deployments need no changes.
 */
@Injectable()
export class AiCredentialsService {
  constructor(
    @InjectRepository(AiCredentials) private readonly repo: Repository<AiCredentials>,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
  ) {}

  get mode(): AiCredentialMode {
    return this.config.PHOTO_AI_MODE === PhotoAiMode.Managed ? 'managed' : 'own_key';
  }

  private get master(): Buffer | null {
    return encryptionKey(this.config.PHOTO_AI_ENCRYPTION_KEY);
  }

  private requireMaster(): Buffer {
    const master = this.master;
    if (!master) throw unavailable();
    return master;
  }

  private async read(em: EntityManager, lock = false): Promise<AiCredentials> {
    const query = em
      .createQueryBuilder(AiCredentials, 'credentials')
      .addSelect('credentials.encryptedKey')
      .where('credentials.id = :id', { id: 1 });
    if (lock) query.setLock('pessimistic_write');
    const row = await query.getOne();
    if (!row) throw unavailable();
    return row;
  }

  private stateFor(encryptedKey: string | null): AiCredentialState {
    if (this.mode === 'managed') {
      const usable = Boolean(this.config.PHOTO_AI_MANAGED_API_KEY);
      return { mode: 'managed', configured: true, usable, setupAvailable: true };
    }
    const master = this.master;
    return {
      mode: 'own_key',
      configured: Boolean(encryptedKey),
      usable: Boolean(master && encryptedKey && decryptCredential(encryptedKey, master)),
      setupAvailable: Boolean(master),
    };
  }

  /** Never contains the key or its ciphertext. */
  async state(em: EntityManager = this.repo.manager): Promise<AiCredentialState> {
    if (this.mode === 'managed') return this.stateFor(null);
    try {
      return this.stateFor((await this.read(em)).encryptedKey);
    } catch {
      throw unavailable();
    }
  }

  /**
   * Fresh lookup at each paid call. The caller checks its own feature switch
   * and access policy first, and never hands the key to a controller.
   */
  async requireApiKey(): Promise<string> {
    if (this.mode === 'managed') {
      const managedKey = this.config.PHOTO_AI_MANAGED_API_KEY;
      if (!managedKey) throw unavailable();
      return managedKey;
    }
    try {
      const { encryptedKey } = await this.read(this.repo.manager);
      const master = this.master;
      const credential = encryptedKey && master ? decryptCredential(encryptedKey, master) : null;
      if (!credential) throw unavailable();
      return credential;
    } catch {
      throw unavailable();
    }
  }

  /** Cheap pre-check so callers reject a forbidden change before taking locks. */
  assertChangeAllowed(change: AiCredentialChange): void {
    if (change.kind === 'keep') return;
    if (this.mode === 'managed') throw new BadRequestException(MANAGED_KEY_REJECTED);
    if (change.kind === 'replace' && !this.master) throw unavailable();
  }

  /**
   * Applies a key change inside the caller's transaction and returns the
   * resulting state. Callers lock their own settings row before calling, so
   * every AI settings save takes the locks in the same order.
   */
  async apply(
    em: EntityManager,
    change: AiCredentialChange,
  ): Promise<{ state: AiCredentialState; action: AiCredentialAction }> {
    this.assertChangeAllowed(change);
    if (this.mode === 'managed') return { state: this.stateFor(null), action: 'unchanged' };
    const row = await this.read(em, true);
    if (change.kind === 'keep')
      return { state: this.stateFor(row.encryptedKey), action: 'unchanged' };
    const encryptedKey =
      change.kind === 'replace' ? encryptCredential(change.apiKey, this.requireMaster()) : null;
    await em.update(AiCredentials, { id: 1 }, { encryptedKey, revision: row.revision + 1 });
    return {
      state: this.stateFor(encryptedKey),
      action: change.kind === 'replace' ? 'replaced' : 'removed',
    };
  }
}
