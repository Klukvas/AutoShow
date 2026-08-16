import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../common/redis/redis.service';
import { Lead } from '../leads/entities/lead.entity';
import { Listing } from '../listings/entities/listing.entity';

/**
 * Back-office dashboard numbers. Money values are normalized into the site's
 * default currency using each listing's stored fx_rate (the same rate that
 * produced price_normalized), so mixed-currency listings sum correctly.
 */

export interface AnalyticsSummary {
  listings: Record<string, number>;
  sales: {
    total: number;
    last30d: number;
    commissionTotal: string;
    commission30d: string;
    /** Commission the active client cars would bring at asking price. */
    commissionPipeline: string;
  };
  leads: {
    byStatus: Record<string, number>;
    last30d: number;
  };
  views: {
    total: number;
    top: Array<{
      id: string;
      slug: string;
      title: string;
      status: string;
      viewsCount: number;
      /** Leads this listing generated (all time). */
      leadsCount: number;
    }>;
  };
  /** Overall storefront funnel: leads attributed to a listing vs total views. */
  conversion: { views: number; leads: number; rate: number };
  /** Lead source breakdown from UTM (last 30 days); null source → 'direct'. */
  attribution: Array<{ source: string; count: number }>;
  salesByMonth: Array<{ month: string; count: number; commission: string }>;
}

const CACHE_KEY = 'analytics:summary';
/** Dashboard tolerates a slightly stale view; caching spares 8+ aggregates per load. */
const CACHE_TTL_SECONDS = 60;

const COMMISSION_NORMALIZED = `COALESCE(commission_amount * COALESCE(fx_rate, 1), 0)`;
/** Earnings an unsold listing would generate at its asking price. */
const PIPELINE_COMMISSION = `
  CASE fee_type
    WHEN 'fixed' THEN COALESCE(fee_fixed_amount * COALESCE(fx_rate, 1), 0)
    WHEN 'percent' THEN price_normalized * COALESCE(fee_percent, 0) / 100
    ELSE 0
  END`;

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    private readonly redis: RedisService,
  ) {}

  async summary(): Promise<AnalyticsSummary> {
    // Short-TTL cache: the dashboard fires 10+ aggregates; a cheap 60s cache
    // keeps repeated loads (and the public /stats spillover) off the DB.
    const cached = await this.redis.client.get(CACHE_KEY).catch(() => null);
    if (cached) {
      try {
        return JSON.parse(cached) as AnalyticsSummary;
      } catch {
        // Corrupt cache entry — fall through and recompute.
      }
    }
    const result = await this.compute();
    await this.redis.client
      .set(CACHE_KEY, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS)
      .catch((err: unknown) => this.logger.warn({ err }, 'failed to cache analytics summary'));
    return result;
  }

  private async compute(): Promise<AnalyticsSummary> {
    const [
      statusRows,
      salesRow,
      pipelineRow,
      leadRows,
      leads30dRow,
      viewsRow,
      topViews,
      byMonth,
      attributedRow,
      attribution,
    ] = await Promise.all([
      this.listings.query(
        `SELECT status, COUNT(*)::int AS count
           FROM listings WHERE deleted_at IS NULL GROUP BY status`,
      ),
      this.listings.query(
        `SELECT
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE sold_at >= now() - interval '30 days')::int AS last30d,
             COALESCE(SUM(${COMMISSION_NORMALIZED}), 0)::numeric(14,2) AS commission_total,
             COALESCE(SUM(${COMMISSION_NORMALIZED})
               FILTER (WHERE sold_at >= now() - interval '30 days'), 0)::numeric(14,2) AS commission_30d
           FROM listings
           WHERE status = 'sold' AND deleted_at IS NULL`,
      ),
      this.listings.query(
        `SELECT COALESCE(SUM(${PIPELINE_COMMISSION}), 0)::numeric(14,2) AS pipeline
           FROM listings
           WHERE status IN ('published', 'reserved') AND deleted_at IS NULL`,
      ),
      this.leads.query(
        `SELECT status, COUNT(*)::int AS count
           FROM leads WHERE deleted_at IS NULL GROUP BY status`,
      ),
      this.leads.query(
        `SELECT COUNT(*)::int AS count
           FROM leads WHERE deleted_at IS NULL AND created_at >= now() - interval '30 days'`,
      ),
      this.listings.query(
        `SELECT COALESCE(SUM(views_count), 0)::int AS total
           FROM listings WHERE deleted_at IS NULL`,
      ),
      this.listings.query(
        `SELECT l.id, l.slug, l.title, l.status, l.views_count,
             (SELECT COUNT(*) FROM leads ld
                WHERE ld.listing_id = l.id AND ld.deleted_at IS NULL)::int AS leads_count
           FROM listings l
           WHERE l.deleted_at IS NULL AND l.status IN ('published', 'reserved', 'sold')
           ORDER BY l.views_count DESC, l.created_at DESC
           LIMIT 5`,
      ),
      this.listings.query(
        `SELECT
             to_char(date_trunc('month', sold_at), 'YYYY-MM') AS month,
             COUNT(*)::int AS count,
             COALESCE(SUM(${COMMISSION_NORMALIZED}), 0)::numeric(14,2) AS commission
           FROM listings
           WHERE status = 'sold' AND deleted_at IS NULL
             AND sold_at >= date_trunc('month', now()) - interval '5 months'
           GROUP BY 1 ORDER BY 1`,
      ),
      // Leads attributed to a listing (for the overall views→leads funnel).
      this.leads.query(
        `SELECT COUNT(*)::int AS count
           FROM leads WHERE deleted_at IS NULL AND listing_id IS NOT NULL`,
      ),
      // UTM source breakdown, last 30 days; null/blank source → 'direct'.
      this.leads.query(
        `SELECT COALESCE(NULLIF(utm->>'source', ''), 'direct') AS source, COUNT(*)::int AS count
           FROM leads
           WHERE deleted_at IS NULL AND created_at >= now() - interval '30 days'
           GROUP BY 1 ORDER BY count DESC, source ASC
           LIMIT 8`,
      ),
    ]);

    const toCountMap = (rows: Array<{ status: string; count: number }>) =>
      Object.fromEntries(rows.map((row) => [row.status, row.count]));

    return {
      listings: toCountMap(statusRows),
      sales: {
        total: salesRow[0]?.total ?? 0,
        last30d: salesRow[0]?.last30d ?? 0,
        commissionTotal: String(salesRow[0]?.commission_total ?? '0.00'),
        commission30d: String(salesRow[0]?.commission_30d ?? '0.00'),
        commissionPipeline: String(pipelineRow[0]?.pipeline ?? '0.00'),
      },
      leads: {
        byStatus: toCountMap(leadRows),
        last30d: leads30dRow[0]?.count ?? 0,
      },
      views: {
        total: viewsRow[0]?.total ?? 0,
        top: topViews.map(
          (row: {
            id: string;
            slug: string;
            title: string;
            status: string;
            views_count: number;
            leads_count: number;
          }) => ({
            id: row.id,
            slug: row.slug,
            title: row.title,
            status: row.status,
            viewsCount: row.views_count,
            leadsCount: row.leads_count,
          }),
        ),
      },
      conversion: this.conversionOf(viewsRow[0]?.total ?? 0, attributedRow[0]?.count ?? 0),
      attribution: attribution.map((row: { source: string; count: number }) => ({
        source: row.source,
        count: row.count,
      })),
      salesByMonth: byMonth.map((row: { month: string; count: number; commission: string }) => ({
        month: row.month,
        count: row.count,
        commission: String(row.commission),
      })),
    };
  }

  /** Views→leads funnel; rate is a percentage rounded to one decimal. */
  private conversionOf(views: number, leads: number): AnalyticsSummary['conversion'] {
    const rate = views > 0 ? Math.round((leads / views) * 1000) / 10 : 0;
    return { views, leads, rate };
  }
}
