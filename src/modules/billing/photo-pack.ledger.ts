import type { Logger } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import type { AuditLogService } from '../audit/audit-log.service';
import { creditPack, refundPack } from '../photo-ai/photo-credits.store';
import { BillingInvoice } from './entities/billing-invoice.entity';
import type { MonobankInvoiceStatusInfo } from './monobank.types';

/**
 * Photo-pack side of a Monobank payment, run inside the invoice's locked
 * transaction (invoice row → balance row, same order as hosting credits).
 * The ledger's per-invoice unique entries make both effects happen once.
 */

interface PackContext {
  em: EntityManager;
  audit: AuditLogService;
  info: MonobankInvoiceStatusInfo;
  invoice: BillingInvoice;
  actor: AuthenticatedUser | null;
  now: Date;
}

function packPhotos(invoice: BillingInvoice): number {
  if (!invoice.photos || invoice.photos <= 0) {
    throw new Error(`Photo-pack invoice ${invoice.invoiceId} has no photo count`);
  }
  return invoice.photos;
}

const auditActor = (actor: AuthenticatedUser | null) => ({
  actorId: actor?.id ?? null,
  actorRole: actor?.role ?? null,
});

export async function creditPhotoPack(ctx: PackContext): Promise<void> {
  const { em, audit, info, invoice, actor, now } = ctx;
  const photos = packPhotos(invoice);
  await creditPack(em, invoice.invoiceId, photos, actor?.id ?? null);
  await em.getRepository(BillingInvoice).update({ id: invoice.id }, { creditedAt: now });
  await audit.record(
    {
      action: 'billing.photo_pack_credited',
      entityType: 'billing',
      diff: { invoiceId: info.invoiceId, amountKop: info.amount, photos },
      ...auditActor(actor),
    },
    em,
  );
}

/**
 * Full refund of a paid pack: its photos leave the balance once. The balance
 * may go negative (photos already used) — AI is then unavailable until the
 * next pack is bought.
 */
export async function refundPhotoPack(ctx: PackContext, logger: Logger): Promise<void> {
  const { em, audit, info, invoice, actor, now } = ctx;
  const photos = packPhotos(invoice);
  await refundPack(em, invoice.invoiceId, photos, actor?.id ?? null);
  await em.getRepository(BillingInvoice).update({ id: invoice.id }, { reversedAt: now });
  logger.warn(
    { invoiceId: info.invoiceId, amount: info.amount, photos },
    'A paid photo pack was reversed — its photos were removed from the balance',
  );
  await audit.record(
    {
      action: 'billing.photo_pack_reversed',
      entityType: 'billing',
      diff: { invoiceId: info.invoiceId, amountKop: info.amount, photos },
      ...auditActor(actor),
    },
    em,
  );
}
