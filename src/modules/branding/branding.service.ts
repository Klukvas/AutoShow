import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import type { Currency } from '../../common/types/currency';
import { AuditLogService } from '../audit/audit-log.service';
import { FxRateProvider } from '../fx/fx-rate.provider';
import { Listing } from '../listings/entities/listing.entity';
import { SiteSettings } from './entities/site-settings.entity';

interface PriceUpdate {
  id: string;
  patch: Pick<Listing, 'priceNormalized' | 'fxRate' | 'fxRateAt'>;
}

@Injectable()
export class BrandingService {
  private readonly logger = new Logger(BrandingService.name);

  constructor(
    @InjectRepository(SiteSettings)
    private readonly repo: Repository<SiteSettings>,
    @InjectRepository(Listing)
    private readonly listings: Repository<Listing>,
    private readonly fx: FxRateProvider,
    private readonly audit: AuditLogService,
  ) {}

  async getCurrent(): Promise<SiteSettings> {
    const settings = await this.repo.findOne({ where: { deletedAt: IsNull() } });
    if (!settings) throw new NotFoundException('Site settings not configured');
    return settings;
  }

  async update(patch: Partial<SiteSettings>, actor: AuthenticatedUser): Promise<SiteSettings> {
    const current = await this.getCurrent();
    const baseChanged =
      patch.defaultCurrency !== undefined && patch.defaultCurrency !== current.defaultCurrency;

    // Every stored priceNormalized is denominated in the base currency, so a
    // base change must renormalize the whole catalog — otherwise price filters
    // and commission analytics silently mix bases. Conversions are computed
    // BEFORE any write: a missing FX pair aborts the update instead of leaving
    // half the catalog in the new base.
    const priceUpdates = baseChanged
      ? await this.computeRenormalizedPrices(patch.defaultCurrency as Currency)
      : [];

    // The bot token is a live credential — the audit log keeps only the fact
    // that it changed, never the value.
    const auditPatch = patch.telegram?.botToken
      ? { ...patch, telegram: { ...patch.telegram, botToken: '***' } }
      : patch;

    const saved = await this.repo.manager.transaction(async (em) => {
      // One multi-row UPDATE applies the JS-computed values (exact same numbers,
      // no SQL rounding change) instead of N per-row round-trips holding the
      // write lock open across the whole catalog.
      if (priceUpdates.length) {
        await this.applyRenormalized(em, priceUpdates);
      }
      if (baseChanged) {
        // The "price dropped" badge compares previous_price_normalized to the
        // current one; both must be in the same base. A base switch invalidates
        // stored previous values, so clear them (badge resets until next edit).
        await em
          .createQueryBuilder()
          .update(Listing)
          .set({ previousPriceNormalized: null, priceChangedAt: null })
          .where('deleted_at IS NULL')
          .execute();
      }
      const settings = await em.save(SiteSettings, { ...current, ...patch });
      await this.audit.record(
        {
          action: 'branding.update',
          entityType: 'site_settings',
          entityId: settings.id,
          diff: { patch: auditPatch },
          actorId: actor.id,
          actorRole: actor.role,
        },
        em,
      );
      return settings;
    });

    if (baseChanged) {
      this.logger.log(
        { count: priceUpdates.length, base: patch.defaultCurrency },
        'Listing prices renormalized after base currency change',
      );
    }
    return saved;
  }

  private async computeRenormalizedPrices(base: Currency): Promise<PriceUpdate[]> {
    const rows = await this.listings.find({
      where: { deletedAt: IsNull() },
      select: ['id', 'priceAmount', 'priceCurrency'],
    });
    const updates: PriceUpdate[] = [];
    for (const row of rows) {
      const fx = await this.fx.convert(row.priceAmount, row.priceCurrency, base);
      updates.push({
        id: row.id,
        patch: { priceNormalized: fx.value, fxRate: fx.rate, fxRateAt: fx.asOf },
      });
    }
    return updates;
  }

  /**
   * Apply the precomputed renormalized prices in a single UPDATE ... FROM
   * (VALUES ...) — the values are exactly those computed by FxRateProvider, so
   * there's no rounding change, just one round-trip instead of N.
   */
  private async applyRenormalized(em: EntityManager, updates: PriceUpdate[]): Promise<void> {
    const rows: string[] = [];
    const params: unknown[] = [];
    updates.forEach((u, i) => {
      const b = i * 4;
      // Cast the first row's placeholders so the VALUES columns get their types;
      // later rows inherit them.
      rows.push(
        i === 0
          ? `($${b + 1}::uuid, $${b + 2}::numeric, $${b + 3}::numeric, $${b + 4}::timestamptz)`
          : `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4})`,
      );
      params.push(u.id, u.patch.priceNormalized, u.patch.fxRate, u.patch.fxRateAt);
    });
    await em.query(
      `UPDATE listings AS l
         SET price_normalized = v.pn, fx_rate = v.fr, fx_rate_at = v.fa
         FROM (VALUES ${rows.join(', ')}) AS v(id, pn, fr, fa)
         WHERE l.id = v.id`,
      params,
    );
  }
}
