import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  ensureBalance,
  needsBalanceSetup,
  readBalance,
  type PhotoBalance,
} from '../photo-ai/photo-credits.store';
import type { BillingInvoiceView } from './billing-invoice.view';
import { BILLING_SETTINGS, type BillingSettings } from './billing.config';
import { BillingService } from './billing.service';
import { BillingInvoice } from './entities/billing-invoice.entity';

/** "Low" banner once at most this share of a pack (or 5 photos) is left. */
const LOW_SHARE_OF_PACK = 0.1;
const LOW_MIN_PHOTOS = 5;

export type PhotoPackOverview =
  | { mode: 'own_key' }
  | {
      mode: 'managed';
      packSize: number;
      packPriceUah: number;
      balance: PhotoBalance;
      isLow: boolean;
      isEmpty: boolean;
      invoices: BillingInvoiceView[];
    };

export function lowThreshold(packSize: number): number {
  return Math.max(LOW_MIN_PHOTOS, Math.ceil(packSize * LOW_SHARE_OF_PACK));
}

/**
 * Managed photo-AI packs: admin-only overview (balance + purchase history)
 * and purchase through the shared Monobank invoice flow. Crediting/refunds
 * happen in BillingService.applyStatus like any other invoice.
 */
@Injectable()
export class PhotoPackService {
  constructor(
    @Inject(BILLING_SETTINGS) private readonly settings: BillingSettings,
    @InjectRepository(BillingInvoice) private readonly invoices: Repository<BillingInvoice>,
    private readonly billing: BillingService,
  ) {}

  async overview(): Promise<PhotoPackOverview> {
    const packs = this.settings.photoPacks;
    if (!packs.isEnabled) return { mode: 'own_key' };
    const em = this.invoices.manager;
    if (await needsBalanceSetup(em, packs.freePhotos)) {
      await em.transaction((tx) => ensureBalance(tx, packs.freePhotos));
    }
    const balance = await readBalance(em);
    return {
      mode: 'managed',
      packSize: packs.size,
      packPriceUah: packs.priceUah,
      balance,
      isEmpty: balance.available <= 0,
      isLow: balance.available > 0 && balance.available <= lowThreshold(packs.size),
      invoices: await this.billing.listInvoices('photo_pack'),
    };
  }

  async buyPack(actor: AuthenticatedUser): Promise<{ invoiceId: string; pageUrl: string }> {
    const packs = this.assertManaged();
    return this.billing.createMonobankInvoice(
      {
        kind: 'photo_pack',
        amountKop: packs.priceUah * 100,
        destination: `Пакет обробки фото з ШІ (${packs.size} фото)`,
        periodMonths: null,
        photos: packs.size,
        redirectUrl: packs.redirectUrl,
      },
      actor,
    );
  }

  sync(invoiceId: string, actor: AuthenticatedUser): Promise<BillingInvoiceView> {
    this.assertManaged();
    return this.billing.syncInvoice(invoiceId, actor, 'photo_pack');
  }

  private assertManaged(): BillingSettings['photoPacks'] {
    const packs = this.settings.photoPacks;
    if (!packs.isEnabled) {
      throw new ConflictException('Пакети фото доступні лише з ключем ШІ від постачальника сайту.');
    }
    return packs;
  }
}
