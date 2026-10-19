import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import type { AppConfig } from '../../config/config.module';
import { PhotoAiMode } from '../../config/env.validation';
import {
  createCreditStore,
  outcomeFor,
  type CreditBalance,
} from '../ai-credentials/ai-credits.store';
import type { AdminRole } from '../admin-users/entities/admin-user.entity';
import { ListingAiBalance } from './entities/listing-ai-balance.entity';

export const LISTING_AI_CREDITS_EXHAUSTED_ADMIN = 'Генерації описів закінчилися — докупіть пакет.';
export const LISTING_AI_CREDITS_EXHAUSTED_EDITOR = 'Генерація описів ШІ недоступна.';
const SWEEP_BATCH = 100;

const store = createCreditStore({
  balance: 'listing_ai_balance',
  ledger: 'listing_ai_ledger',
  generations: 'listing_ai_generations',
  unit: 'descriptions',
});

/**
 * Managed-mode description balance: one description is reserved when a draft
 * is queued, consumed only when it ends `ready`, released otherwise. In
 * own_key mode (the same switch as photo AI) every method is a no-op.
 */
@Injectable()
export class ListingAiCreditsService {
  private readonly logger = new Logger(ListingAiCreditsService.name);

  constructor(
    @InjectRepository(ListingAiBalance) private readonly balances: Repository<ListingAiBalance>,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
  ) {}

  get isManaged(): boolean {
    return this.config.PHOTO_AI_MODE === PhotoAiMode.Managed;
  }

  /** Current balance; writes only on first use (row + one-time free descriptions). */
  async balance(): Promise<CreditBalance> {
    const free = this.config.LISTING_AI_FREE_DESCRIPTIONS;
    const em = this.balances.manager;
    if (await store.needsBalanceSetup(em, free)) {
      await em.transaction((tx) => store.ensureBalance(tx, free));
    }
    return store.readBalance(em);
  }

  async hasCredit(): Promise<boolean> {
    return !this.isManaged || (await this.balance()).available > 0;
  }

  exhaustedReason(role: AdminRole): string {
    return role === 'admin'
      ? LISTING_AI_CREDITS_EXHAUSTED_ADMIN
      : LISTING_AI_CREDITS_EXHAUSTED_EDITOR;
  }

  /** Inside the draft's transaction: rejects (rolls it back) when nothing is left. */
  async reserve(
    em: EntityManager,
    generationId: string,
    actor: { id: string; role: AdminRole },
  ): Promise<void> {
    if (!this.isManaged) return;
    await store.ensureBalance(em, this.config.LISTING_AI_FREE_DESCRIPTIONS);
    if (await store.reserve(em, generationId, actor.id)) return;
    throw new HttpException(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        error: 'ListingAiCreditsExhausted',
        message: this.exhaustedReason(actor.role),
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }

  /** Settles by current status: ready → consume, failed/interrupted → release, in flight → nothing. */
  async settle(generationId: string, status: string | null): Promise<boolean> {
    if (status !== null && !['ready', 'failed', 'interrupted'].includes(status)) return false;
    return this.balances.manager.transaction((em) =>
      store.settle(em, generationId, outcomeFor(status)),
    );
  }

  /** Recovery: settles reservations of finished or vanished drafts (e.g. after a crash). */
  async sweep(): Promise<number> {
    const open = await store.unsettledGenerations(this.balances.manager, SWEEP_BATCH);
    let settled = 0;
    for (const { generationId, outcome } of open) {
      const done = await this.balances.manager.transaction((em) =>
        store.settle(em, generationId, outcome),
      );
      if (done) settled += 1;
    }
    if (settled) this.logger.warn({ settled }, 'listing AI reservations settled by recovery');
    return settled;
  }
}
