import { randomUUID } from 'node:crypto';
import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuditLogService } from '../audit/audit-log.service';
import {
  extendAccount,
  readPaidUntil,
  rollbackAccount,
  seedAccount,
} from './billing-account.store';
import {
  BILLING_SETTINGS,
  invoiceAmountKop,
  seedPaidUntil,
  type BillingSettings,
} from './billing.config';
import { computeBillingState, type BillingSnapshot } from './billing-state';
import { BillingInvoice } from './entities/billing-invoice.entity';
import { INVOICE_VALIDITY_SECONDS, MonobankApiError, MonobankClient } from './monobank.client';
import { UAH_CCY, type MonobankInvoiceStatusInfo } from './monobank.types';

/** Guard lookups hit the DB at most this often per process (credits invalidate it). */
export const ACCOUNT_CACHE_TTL_MS = 15_000;
const INVOICE_HISTORY_LIMIT = 50;

export type EditorBillingStatus = { enabled: boolean; blocked: boolean };

export type AdminBillingStatus =
  | { enabled: false; blocked: false }
  | {
      enabled: true;
      blocked: boolean;
      state: BillingSnapshot['state'];
      paidUntil: string;
      blockAt: string;
      daysLeft: number;
      daysUntilBlock: number;
      monthlyPriceUah: number;
      periodMonths: number;
      amountUah: number;
      remindDays: number;
      graceDays: number;
    };

/**
 * `mismatch`: Monobank reports the invoice paid, but amount/currency differ
 * from what we billed, so nothing was credited — needs a manual check.
 */
export type InvoiceViewStatus = BillingInvoice['status'] | 'mismatch';

export interface BillingInvoiceView {
  invoiceId: string;
  amountUah: number;
  status: InvoiceViewStatus;
  periodMonths: number;
  createdAt: string;
  creditedAt: string | null;
  /** Only while the invoice can still be paid. */
  pageUrl: string | null;
}

export type ApplyResult = 'credited' | 'reversed' | 'updated' | 'stale' | 'mismatch';

interface CachedAccount {
  paidUntil: Date;
  fetchedAt: number;
}

const PAYABLE_STATUSES: ReadonlyArray<BillingInvoice['status']> = ['created', 'processing'];

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private cache: CachedAccount | null = null;

  constructor(
    @Inject(BILLING_SETTINGS) private readonly settings: BillingSettings,
    @InjectRepository(BillingInvoice) private readonly invoices: Repository<BillingInvoice>,
    private readonly monobank: MonobankClient,
    private readonly audit: AuditLogService,
  ) {}

  get isEnabled(): boolean {
    return this.settings.isEnabled;
  }

  /** null when billing is disabled — nothing is ever blocked or reminded then. */
  async getSnapshot(now: Date = new Date()): Promise<BillingSnapshot | null> {
    if (!this.settings.isEnabled) return null;
    const paidUntil = await this.getPaidUntil(now);
    return computeBillingState(paidUntil, now, this.settings);
  }

  async isBlocked(now: Date = new Date()): Promise<boolean> {
    const snapshot = await this.getSnapshot(now);
    return snapshot?.state === 'blocked';
  }

  /** Editors learn only whether the panel is locked — no price, dates or reminders. */
  async getEditorStatus(now: Date = new Date()): Promise<EditorBillingStatus> {
    const snapshot = await this.getSnapshot(now);
    return { enabled: snapshot !== null, blocked: snapshot?.state === 'blocked' };
  }

  async getAdminStatus(now: Date = new Date()): Promise<AdminBillingStatus> {
    const snapshot = await this.getSnapshot(now);
    if (!snapshot) return { enabled: false, blocked: false };
    return {
      enabled: true,
      blocked: snapshot.state === 'blocked',
      state: snapshot.state,
      paidUntil: snapshot.paidUntil.toISOString(),
      blockAt: snapshot.blockAt.toISOString(),
      daysLeft: snapshot.daysLeft,
      daysUntilBlock: snapshot.daysUntilBlock,
      monthlyPriceUah: this.settings.monthlyPriceUah,
      periodMonths: this.settings.periodMonths,
      amountUah: invoiceAmountKop(this.settings) / 100,
      remindDays: this.settings.remindDays,
      graceDays: this.settings.graceDays,
    };
  }

  async listInvoices(): Promise<BillingInvoiceView[]> {
    const rows = await this.invoices.find({
      order: { createdAt: 'DESC' },
      take: INVOICE_HISTORY_LIMIT,
    });
    const now = new Date();
    return rows.map((row) => toInvoiceView(row, now));
  }

  async createInvoice(actor: AuthenticatedUser): Promise<{ invoiceId: string; pageUrl: string }> {
    this.assertEnabled();
    const id = randomUUID();
    const amountKop = invoiceAmountKop(this.settings);
    const months = this.settings.periodMonths;
    let created: { invoiceId: string; pageUrl: string };
    try {
      created = await this.monobank.createInvoice({
        amountKop,
        reference: id,
        destination: `Оплата хостингу та обслуговування сайту (${months} міс.)`,
      });
    } catch (err) {
      throw this.toGatewayError(err, 'Не вдалося створити рахунок у Monobank. Спробуйте пізніше.');
    }
    try {
      await this.invoices.manager.transaction(async (em) => {
        await em.getRepository(BillingInvoice).insert({
          id,
          invoiceId: created.invoiceId,
          amountKop,
          ccy: UAH_CCY,
          status: 'created',
          periodMonths: months,
          pageUrl: created.pageUrl,
          createdBy: actor.id,
          modifiedAt: null,
          creditedAt: null,
        });
        await this.audit.record(
          {
            action: 'billing.invoice_created',
            entityType: 'billing',
            diff: { invoiceId: created.invoiceId, amountKop, periodMonths: months },
            actorId: actor.id,
            actorRole: actor.role,
          },
          em,
        );
      });
    } catch (err) {
      await this.cancelOrphanInvoice(created.invoiceId, err);
      throw err;
    }
    return created;
  }

  /** Admin fallback when a webhook was missed: re-reads Monobank and credits if paid. */
  async syncInvoice(invoiceId: string, actor: AuthenticatedUser): Promise<BillingInvoiceView> {
    this.assertEnabled();
    const known = await this.invoices.findOne({ where: { invoiceId } });
    if (!known) throw new NotFoundException('Рахунок не знайдено');
    await this.refreshFromMonobank(invoiceId, actor);
    const updated = await this.invoices.findOneOrFail({ where: { invoiceId } });
    return toInvoiceView(updated, new Date());
  }

  /** Webhook entry point (signature already verified). Unknown invoices are ignored. */
  async handleWebhook(invoiceId: string): Promise<ApplyResult | 'ignored'> {
    if (!this.settings.isEnabled) return 'ignored';
    const known = await this.invoices.findOne({ where: { invoiceId } });
    if (!known) {
      // A signed webhook for an invoice we never stored means money may have
      // arrived for an orphan invoice — loud, so an operator can reconcile it.
      this.logger.error({ invoiceId }, 'Monobank webhook for an unknown invoice ignored');
      return 'ignored';
    }
    return this.refreshFromMonobank(invoiceId, null);
  }

  /**
   * Applies one authoritative Monobank status to the local invoice and credits
   * the account at most once. Everything runs under row locks (invoice, then
   * account) so duplicate or concurrent webhooks/syncs serialize here.
   */
  async applyStatus(
    info: MonobankInvoiceStatusInfo,
    actor: AuthenticatedUser | null,
    now: Date = new Date(),
  ): Promise<ApplyResult> {
    const result = await this.invoices.manager.transaction((em) =>
      this.applyStatusInTx(em, info, actor, now),
    );
    // Both move paid_until: the guard must see it now, not after its cache TTL.
    if (result === 'credited' || result === 'reversed') this.invalidateCache();
    return result;
  }

  invalidateCache(): void {
    this.cache = null;
  }

  private async refreshFromMonobank(
    invoiceId: string,
    actor: AuthenticatedUser | null,
  ): Promise<ApplyResult> {
    let info: MonobankInvoiceStatusInfo;
    try {
      info = await this.monobank.getInvoiceStatus(invoiceId);
    } catch (err) {
      throw this.toGatewayError(err, 'Не вдалося отримати статус оплати з Monobank.');
    }
    return this.applyStatus(info, actor);
  }

  /**
   * The invoice exists at Monobank but not here, so a payment for it could
   * never be credited — cancel it (best effort) and leave a trace either way.
   */
  private async cancelOrphanInvoice(invoiceId: string, cause: unknown): Promise<void> {
    const reason = cause instanceof Error ? cause.message : String(cause);
    // The commit may have succeeded with only its acknowledgement lost — never
    // cancel an invoice that is in fact stored.
    const stored = await this.invoices.findOne({ where: { invoiceId } }).catch(() => null);
    if (stored) {
      this.logger.error({ invoiceId, reason }, 'Invoice persisted despite the error — kept');
      return;
    }
    this.logger.error({ invoiceId, reason }, 'Storing a Monobank invoice failed — cancelling it');
    try {
      await this.monobank.removeInvoice(invoiceId);
    } catch {
      this.logger.error({ invoiceId }, 'Cancelling the orphan Monobank invoice failed');
    }
  }

  private async applyStatusInTx(
    em: EntityManager,
    info: MonobankInvoiceStatusInfo,
    actor: AuthenticatedUser | null,
    now: Date,
  ): Promise<ApplyResult> {
    const invoice = await em.getRepository(BillingInvoice).findOne({
      where: { invoiceId: info.invoiceId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!invoice) throw new NotFoundException('Рахунок не знайдено');

    // Webhooks may arrive out of order: never let an older status overwrite a
    // newer one. Monobank's modifiedDate is optional — compare only when both exist.
    if (isOlder(info.modifiedDate, invoice.modifiedAt)) return 'stale';
    // A refund is final: nothing (e.g. a late, dateless `success`) may
    // overwrite it, re-label it or credit it again.
    if (invoice.status === 'reversed' && info.status !== 'reversed') return 'stale';

    await em
      .getRepository(BillingInvoice)
      .update(
        { id: invoice.id },
        { status: info.status, modifiedAt: info.modifiedDate ?? invoice.modifiedAt },
      );

    // Full refund of a credited payment: roll back once. Only the transition
    // into `reversed` counts (duplicates are no-ops). Since a stored reversal
    // is terminal (checked above), the reversed_at check is purely defensive
    // and unreachable today. Partial refunds stay `success` at Monobank and
    // never get here.
    const isNewReversal =
      info.status === 'reversed' && invoice.status !== 'reversed' && !invoice.reversedAt;
    if (isNewReversal && invoice.creditedAt) {
      await this.reverseInvoice(em, info, invoice, actor, now);
      return 'reversed';
    }
    if (info.status !== 'success' || invoice.creditedAt) return 'updated';

    if (info.ccy !== UAH_CCY || info.ccy !== invoice.ccy || info.amount !== invoice.amountKop) {
      // Repeated webhooks/syncs for the same paid invoice must not pile up audit rows.
      if (invoice.status !== 'success') await this.recordMismatch(em, info, invoice, actor);
      return 'mismatch';
    }
    await this.creditInvoice(em, info, invoice, actor, now);
    return 'credited';
  }

  private async creditInvoice(
    em: EntityManager,
    info: MonobankInvoiceStatusInfo,
    invoice: BillingInvoice,
    actor: AuthenticatedUser | null,
    now: Date,
  ): Promise<void> {
    const seed = seedPaidUntil(this.settings, now);
    const change = await extendAccount(em, invoice.periodMonths, now, seed);
    await em
      .getRepository(BillingInvoice)
      .update(
        { id: invoice.id },
        { creditedAt: now, creditedFrom: change.creditedFrom, creditedUntil: change.after },
      );
    await this.audit.record(
      {
        action: 'billing.payment_credited',
        entityType: 'billing',
        diff: {
          invoiceId: info.invoiceId,
          amountKop: info.amount,
          periodMonths: invoice.periodMonths,
          paidUntilBefore: change.before.toISOString(),
          paidUntilAfter: change.after.toISOString(),
        },
        ...auditActor(actor),
      },
      em,
    );
  }

  private async recordMismatch(
    em: EntityManager,
    info: MonobankInvoiceStatusInfo,
    invoice: BillingInvoice,
    actor: AuthenticatedUser | null,
  ): Promise<void> {
    this.logger.error(
      { invoiceId: info.invoiceId, amount: info.amount, ccy: info.ccy },
      'Paid amount/currency does not match the invoice — not credited',
    );
    await this.audit.record(
      {
        action: 'billing.payment_mismatch',
        entityType: 'billing',
        diff: {
          invoiceId: info.invoiceId,
          expectedAmountKop: invoice.amountKop,
          paidAmountKop: info.amount,
          ccy: info.ccy,
        },
        ...auditActor(actor),
      },
      em,
    );
  }

  /**
   * A credited payment was fully refunded: take back exactly the period it
   * added (later payments stay) and mark the invoice so it happens once.
   */
  private async reverseInvoice(
    em: EntityManager,
    info: MonobankInvoiceStatusInfo,
    invoice: BillingInvoice,
    actor: AuthenticatedUser | null,
    now: Date,
  ): Promise<void> {
    const change = await rollbackAccount(em, invoice, seedPaidUntil(this.settings, now));
    await em.getRepository(BillingInvoice).update({ id: invoice.id }, { reversedAt: now });
    this.logger.warn(
      {
        invoiceId: info.invoiceId,
        amount: info.amount,
        paidUntilBefore: change.before.toISOString(),
        paidUntilAfter: change.after.toISOString(),
      },
      'A credited Monobank payment was reversed — paid period rolled back',
    );
    await this.audit.record(
      {
        action: 'billing.payment_reversed',
        entityType: 'billing',
        diff: {
          invoiceId: info.invoiceId,
          amountKop: info.amount,
          paidUntilBefore: change.before.toISOString(),
          paidUntilAfter: change.after.toISOString(),
        },
        ...auditActor(actor),
      },
      em,
    );
  }

  private async getPaidUntil(now: Date): Promise<Date> {
    if (this.cache && now.getTime() - this.cache.fetchedAt < ACCOUNT_CACHE_TTL_MS) {
      return this.cache.paidUntil;
    }
    const em = this.invoices.manager;
    let paidUntil = await readPaidUntil(em);
    if (!paidUntil) {
      await seedAccount(em, seedPaidUntil(this.settings, now));
      paidUntil = await readPaidUntil(em);
    }
    if (!paidUntil) throw new Error('billing_account could not be seeded');
    this.cache = { paidUntil, fetchedAt: now.getTime() };
    return paidUntil;
  }

  private assertEnabled(): void {
    if (!this.settings.isEnabled) throw new ConflictException('Оплату обслуговування вимкнено');
  }

  private toGatewayError(err: unknown, message: string): Error {
    if (err instanceof MonobankApiError) return new BadGatewayException(message);
    return err instanceof Error ? err : new Error(String(err));
  }
}

function isOlder(incoming: Date | null, stored: Date | null): boolean {
  return incoming !== null && stored !== null && incoming.getTime() < stored.getTime();
}

function auditActor(actor: AuthenticatedUser | null) {
  return { actorId: actor?.id ?? null, actorRole: actor?.role ?? null };
}

/**
 * Monobank sends no webhook when an invoice expires, so an unpaid invoice
 * past its validity is shown as expired and its payment link is dropped.
 * A `success` that was never credited (amount/currency mismatch) is shown as
 * `mismatch`, never as paid.
 */
function toInvoiceView(row: BillingInvoice, now: Date): BillingInvoiceView {
  const isPayable = PAYABLE_STATUSES.includes(row.status);
  const isPastValidity = now.getTime() - row.createdAt.getTime() >= INVOICE_VALIDITY_SECONDS * 1000;
  const isExpired = isPayable && isPastValidity;
  return {
    invoiceId: row.invoiceId,
    amountUah: row.amountKop / 100,
    status: viewStatus(row, isExpired),
    periodMonths: row.periodMonths,
    createdAt: row.createdAt.toISOString(),
    creditedAt: row.creditedAt ? row.creditedAt.toISOString() : null,
    pageUrl: isPayable && !isExpired ? row.pageUrl : null,
  };
}

function viewStatus(row: BillingInvoice, isExpired: boolean): InvoiceViewStatus {
  if (isExpired) return 'expired';
  if (row.status === 'success' && !row.creditedAt) return 'mismatch';
  return row.status;
}
