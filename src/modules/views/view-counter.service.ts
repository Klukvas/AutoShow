import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { RedisService } from '../../common/redis/redis.service';
import type { AppConfig } from '../../config/config.module';

const PENDING_HASH = 'views:pending';
const DEDUP_PREFIX = 'views:seen:';

/**
 * Read-path view counting.
 *
 *   - On every public listing view, we INCR a hash slot keyed by listingId.
 *     Listings table is NOT touched on the hot path.
 *   - A per-IP+listing dedup TTL prevents a single user from inflating views
 *     by refreshing.
 *   - A BullMQ-scheduled job (see workers) periodically drains the pending
 *     hash and adds the deltas to listings.views_count.
 */
@Injectable()
export class ViewCounterService {
  private readonly dedupTtl: number;

  constructor(
    private readonly redis: RedisService,
    @Inject('APP_CONFIG') config: AppConfig,
  ) {
    this.dedupTtl = config.VIEW_DEDUP_TTL_SECONDS;
  }

  async track(listingId: string, ip: string | undefined): Promise<void> {
    if (ip) {
      const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16);
      const dedupKey = `${DEDUP_PREFIX}${listingId}:${ipHash}`;
      const reserved = await this.redis.client.set(dedupKey, '1', 'EX', this.dedupTtl, 'NX');
      if (!reserved) return;
    }
    await this.redis.client.hincrby(PENDING_HASH, listingId, 1);
  }

  /**
   * Atomically read and clear the pending counts. Used by the flush worker.
   */
  async drain(): Promise<Array<{ listingId: string; delta: number }>> {
    const lua = `
      local data = redis.call('HGETALL', KEYS[1])
      redis.call('DEL', KEYS[1])
      return data
    `;
    const raw = (await this.redis.client.eval(lua, 1, PENDING_HASH)) as string[];
    const out: Array<{ listingId: string; delta: number }> = [];
    for (let i = 0; i < raw.length; i += 2) {
      const listingId = raw[i];
      const delta = Number(raw[i + 1]);
      if (Number.isFinite(delta) && delta > 0) {
        out.push({ listingId, delta });
      }
    }
    return out;
  }

  async restore(updates: Array<{ listingId: string; delta: number }>): Promise<void> {
    if (!updates.length) return;
    const pipeline = this.redis.client.pipeline();
    for (const { listingId, delta } of updates) {
      pipeline.hincrby(PENDING_HASH, listingId, delta);
    }
    await pipeline.exec();
  }
}
