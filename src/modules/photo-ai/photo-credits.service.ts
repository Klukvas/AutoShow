import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import type { AppConfig } from '../../config/config.module';
import { PhotoAiMode } from '../../config/env.validation';
import type { AdminRole } from '../admin-users/entities/admin-user.entity';
import { PhotoAiBalance } from './entities/photo-ai-balance.entity';
import {
  ensureBalance,
  needsBalanceSetup,
  outcomeFor,
  readBalance,
  reservePhoto,
  settlePhoto,
  unsettledGenerations,
  type PhotoBalance,
} from './photo-credits.store';

export const PHOTO_CREDITS_EXHAUSTED_ADMIN = 'Фото закінчилися — докупіть пакет.';
export const PHOTO_CREDITS_EXHAUSTED_EDITOR = 'Обробка ШІ недоступна.';
const SWEEP_BATCH = 100;

/**
 * Managed-mode photo balance: one photo is reserved when a generation is
 * queued, consumed only when it ends `ready`, released otherwise. In own_key
 * mode every method is a no-op (the owner pays OpenAI directly).
 */
@Injectable()
export class PhotoCreditsService {
  private readonly logger = new Logger(PhotoCreditsService.name);

  constructor(
    @InjectRepository(PhotoAiBalance) private readonly balances: Repository<PhotoAiBalance>,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
  ) {}

  get isManaged(): boolean {
    return this.config.PHOTO_AI_MODE === PhotoAiMode.Managed;
  }

  /** Current balance; writes only on first use (row + one-time free photos). */
  async balance(): Promise<PhotoBalance> {
    const free = this.config.PHOTO_AI_FREE_PHOTOS;
    const em = this.balances.manager;
    if (await needsBalanceSetup(em, free)) {
      await em.transaction((tx) => ensureBalance(tx, free));
    }
    return readBalance(em);
  }

  async hasCredit(): Promise<boolean> {
    return !this.isManaged || (await this.balance()).available > 0;
  }

  /** Reason shown when the balance is empty — editors never learn about packs. */
  exhaustedReason(role: AdminRole): string {
    return role === 'admin' ? PHOTO_CREDITS_EXHAUSTED_ADMIN : PHOTO_CREDITS_EXHAUSTED_EDITOR;
  }

  /** Inside the generation's transaction: rejects (rolls it back) when nothing is left. */
  async reserve(
    em: EntityManager,
    generationId: string,
    actor: { id: string; role: AdminRole },
  ): Promise<void> {
    if (!this.isManaged) return;
    await ensureBalance(em, this.config.PHOTO_AI_FREE_PHOTOS);
    if (await reservePhoto(em, generationId, actor.id)) return;
    throw new HttpException(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        error: 'PhotoCreditsExhausted',
        message: this.exhaustedReason(actor.role),
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }

  /**
   * Settles a generation by its current status (ready → consume, failed /
   * interrupted → release, in flight → nothing). Safe to call repeatedly and
   * regardless of mode: without a reservation it does nothing.
   */
  async settle(generationId: string, status: string | null): Promise<boolean> {
    if (status !== null && !['ready', 'failed', 'interrupted'].includes(status)) return false;
    return this.balances.manager.transaction((em) =>
      settlePhoto(em, generationId, outcomeFor(status)),
    );
  }

  /** Recovery: settles reservations of finished/vanished generations (e.g. after a crash). */
  async sweep(): Promise<number> {
    const open = await unsettledGenerations(this.balances.manager, SWEEP_BATCH);
    let settled = 0;
    for (const { generationId, outcome } of open) {
      const done = await this.balances.manager.transaction((em) =>
        settlePhoto(em, generationId, outcome),
      );
      if (done) settled += 1;
    }
    if (settled) this.logger.warn({ settled }, 'photo AI reservations settled by recovery');
    return settled;
  }
}
