import type { EntityManager } from 'typeorm';
import {
  createCreditStore,
  outcomeFor,
  type CreditBalance,
  type GenerationOutcome,
} from '../ai-credentials/ai-credits.store';

/**
 * The managed photo balance (photo_ai_balance + append-only photo_ai_ledger),
 * bound to the shared credit accounting. Used by the photo-AI service/worker
 * and by billing (pack purchases). Each function runs inside the caller's
 * transaction.
 */
const store = createCreditStore({
  balance: 'photo_ai_balance',
  ledger: 'photo_ai_ledger',
  generations: 'photo_ai_generations',
  unit: 'photos',
});

export type PhotoBalance = CreditBalance;
export type { GenerationOutcome };
export { outcomeFor };

export const ensureBalance = (em: EntityManager, freePhotos: number) =>
  store.ensureBalance(em, freePhotos);
export const needsBalanceSetup = (em: EntityManager, freePhotos: number) =>
  store.needsBalanceSetup(em, freePhotos);
export const readBalance = (em: EntityManager): Promise<PhotoBalance> => store.readBalance(em);
export const reservePhoto = (em: EntityManager, generationId: string, actorId: string) =>
  store.reserve(em, generationId, actorId);
export const settlePhoto = (em: EntityManager, generationId: string, outcome: GenerationOutcome) =>
  store.settle(em, generationId, outcome);
export const creditPack = (
  em: EntityManager,
  invoiceId: string,
  photos: number,
  actorId: string | null,
) => store.creditPack(em, invoiceId, photos, actorId);
export const refundPack = (
  em: EntityManager,
  invoiceId: string,
  photos: number,
  actorId: string | null,
) => store.refundPack(em, invoiceId, photos, actorId);
export const unsettledGenerations = (em: EntityManager, limit: number) =>
  store.unsettledGenerations(em, limit);
