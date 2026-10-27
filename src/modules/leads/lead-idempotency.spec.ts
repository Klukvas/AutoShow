import type { CreateLeadDto } from './dto/create-lead.dto';
import { LeadsService } from './leads.service';

/**
 * Public-form idempotency (UI-quality review #1). A retry after a timeout or a
 * reload re-sends the same draft key; the service must return the original lead
 * instead of inserting a second row. Redis is faked with an in-memory map that
 * implements the `SET ... EX ... NX` semantics used by the service.
 */
interface LeadRow {
  id: string;
  status: string;
  [key: string]: unknown;
}

function makeService(opts: { failIdempotencyRedis?: boolean } = {}) {
  const svc = Object.create(LeadsService.prototype) as LeadsService & Record<string, unknown>;

  const rows = new Map<string, LeadRow>();
  let seq = 0;

  const leads = {
    create: jest.fn((x: Record<string, unknown>) => x),
    save: jest.fn(async (x: Record<string, unknown>) => {
      const id = `lead-${++seq}`;
      const saved = { ...x, id, status: (x.status as string) ?? 'new' } as LeadRow;
      rows.set(id, saved);
      return saved;
    }),
    findOne: jest.fn(async ({ where }: { where: { id: string } }) => rows.get(where.id) ?? null),
  };

  const store = new Map<string, string>();
  const redisClient = {
    set: jest.fn(async (key: string, value: string, ...args: unknown[]) => {
      if (opts.failIdempotencyRedis) throw new Error('redis is down');
      if (args.includes('NX') && store.has(key)) return null;
      store.set(key, String(value));
      return 'OK';
    }),
    get: jest.fn(async (key: string) => {
      if (opts.failIdempotencyRedis) throw new Error('redis is down');
      return store.get(key) ?? null;
    }),
    del: jest.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
    incr: jest.fn(async (key: string) => {
      const next = Number(store.get(key) ?? 0) + 1;
      store.set(key, String(next));
      return next;
    }),
    expire: jest.fn(async () => 1),
  };

  const listings = { findOne: jest.fn().mockResolvedValue(null) };

  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  Object.assign(svc, {
    leads,
    listings,
    redis: { client: redisClient },
    notifications: { enqueue: jest.fn().mockResolvedValue(undefined) },
    placementPackages: { findPublished: jest.fn() },
    audit: { record: jest.fn() },
    logger,
    config: { LEAD_RATE_PER_HOUR: 5 },
  });

  return { svc, leads, listings, redisClient, logger, store };
}

const callback: CreateLeadDto = {
  type: 'callback',
  name: 'Ivan',
  phone: '+380 50 111 22 33',
} as CreateLeadDto;

describe('LeadsService.create idempotency', () => {
  it('creates one lead and returns the same id for two calls with one key', async () => {
    const { svc, leads, redisClient } = makeService();

    const first = await svc.create(callback, '203.0.113.7', 'draft-key-1');
    const second = await svc.create(callback, '203.0.113.7', 'draft-key-1');

    expect(leads.save).toHaveBeenCalledTimes(1);
    expect(second.id).toBe(first.id);
    expect(second.status).toBe('new');

    // The first request consumed IP + phone tokens; the duplicate consumed none.
    expect(redisClient.incr).toHaveBeenCalledTimes(2);

    // Exact completed mapping: idem:lead:<key> → leadId, TTL 24 h. (The retry
    // also attempts its own `SET NX`, which fails and is recorded by the mock.)
    expect(redisClient.set).toHaveBeenCalledWith('idem:lead:draft-key-1', first.id, 'EX', 86400);
  });

  it('creates the lead as before when the request has no key', async () => {
    const { svc, leads, redisClient } = makeService();

    const saved = await svc.create(callback, '203.0.113.7');

    expect(leads.save).toHaveBeenCalledTimes(1);
    expect(saved.id).toBe('lead-1');
    expect(redisClient.set).not.toHaveBeenCalled();
  });

  it('ignores a key outside the accepted alphabet (creates without dedup)', async () => {
    const { svc, leads, redisClient } = makeService();

    const saved = await svc.create(callback, '203.0.113.7', 'not a valid key!!');

    expect(saved.id).toBe('lead-1');
    expect(leads.save).toHaveBeenCalledTimes(1);
    // No claim was attempted, so nothing named after client input reaches Redis.
    expect(redisClient.set).not.toHaveBeenCalled();
  });

  it('answers 409 and inserts nothing while another request owns the key', async () => {
    const { svc, leads, redisClient, store } = makeService();
    const key = 'draft-key-pending';
    // Another request claimed this draft key and has not published its id yet.
    store.set(`idem:lead:${key}`, '__pending__');

    await expect(svc.create(callback, '203.0.113.7', key)).rejects.toMatchObject({
      status: 409,
    });

    // The loser polls, then gives up: no second row, no rate-limit spend, and it
    // must not release the winner's claim.
    expect(leads.save).not.toHaveBeenCalled();
    expect(redisClient.incr).not.toHaveBeenCalled();
    expect(redisClient.del).not.toHaveBeenCalled();
    expect(store.get(`idem:lead:${key}`)).toBe('__pending__');
  });

  it('releases the key when creation fails after the claim, so a retry creates one lead', async () => {
    const { svc, leads, listings, redisClient, store } = makeService();
    const key = 'draft-key-retry';
    const dto = { ...callback, listingId: 'listing-1' } as CreateLeadDto;

    // First attempt wins the claim, then fails validation: the listing is gone.
    listings.findOne.mockResolvedValueOnce(null);
    await expect(svc.create(dto, '203.0.113.7', key)).rejects.toMatchObject({ status: 404 });
    expect(leads.save).not.toHaveBeenCalled();
    expect(redisClient.del).toHaveBeenCalledWith(`idem:lead:${key}`);
    expect(store.has(`idem:lead:${key}`)).toBe(false);

    // The same draft key now claims cleanly and creates exactly one row.
    listings.findOne.mockResolvedValueOnce({ id: 'listing-1' });
    const saved = await svc.create(dto, '203.0.113.7', key);

    expect(saved.id).toBe('lead-1');
    expect(leads.save).toHaveBeenCalledTimes(1);
    expect(store.get(`idem:lead:${key}`)).toBe('lead-1');
  });

  it('still creates the lead when the idempotency Redis calls fail', async () => {
    const { svc, leads, logger } = makeService({ failIdempotencyRedis: true });

    const saved = await svc.create(callback, '203.0.113.7', 'draft-key-3');

    expect(saved.id).toBe('lead-1');
    expect(leads.save).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      // Only a sha256 prefix is logged — never the raw key (the dedup credential).
      expect.objectContaining({ idempotencyKeyHash: 'cadec27c' }),
      expect.stringContaining('continuing without dedup'),
    );
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('draft-key-3');
  });
});
