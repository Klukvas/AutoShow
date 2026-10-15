import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { BrandingService } from './branding.service';

const actor = { id: 'u1', role: 'admin', email: 'a@x' } as AuthenticatedUser;

/** Prototype view exposing the members under test (private on the class). */
interface Svc {
  applyRenormalized(em: unknown, updates: unknown[]): Promise<void>;
  update(patch: Record<string, unknown>, actor: AuthenticatedUser): Promise<{ id: string }>;
  repo: unknown;
  listings: unknown;
  fx: { convert: jest.Mock };
  audit: { record: jest.Mock };
  logger: unknown;
}

function makeService(): Svc {
  return Object.create(BrandingService.prototype) as unknown as Svc;
}

describe('BrandingService.applyRenormalized', () => {
  it('builds one multi-row UPDATE with flattened, typed params', async () => {
    const svc = makeService();
    const em = { query: jest.fn().mockResolvedValue(undefined) };
    const at = new Date('2024-01-01T00:00:00.000Z');

    await svc.applyRenormalized(em, [
      { id: 'a', patch: { priceNormalized: '100.00', fxRate: '1.000000', fxRateAt: at } },
      { id: 'b', patch: { priceNormalized: '200.00', fxRate: '2.000000', fxRateAt: at } },
    ]);

    expect(em.query).toHaveBeenCalledTimes(1);
    const [sql, params] = em.query.mock.calls[0];
    expect(sql).toContain('UPDATE listings');
    expect(sql).toContain('($1::uuid, $2::numeric, $3::numeric, $4::timestamptz)');
    expect(sql).toContain('($5, $6, $7, $8)');
    expect(params).toEqual(['a', '100.00', '1.000000', at, 'b', '200.00', '2.000000', at]);
  });
});

describe('BrandingService.update on base-currency change', () => {
  it('renormalizes via one statement and audits inside the transaction', async () => {
    const svc = makeService();
    const at = new Date('2024-01-01T00:00:00.000Z');
    const clearChain = {
      update: () => clearChain,
      set: () => clearChain,
      where: () => clearChain,
      execute: jest.fn().mockResolvedValue(undefined),
    };
    const em = {
      query: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(() => clearChain),
      save: jest.fn(async (_entity: unknown, x: Record<string, unknown>) => ({ id: 's1', ...x })),
    };
    svc.repo = {
      findOne: jest.fn().mockResolvedValue({ id: 's1', defaultCurrency: 'USD' }),
      manager: { transaction: jest.fn(async (cb: (m: typeof em) => Promise<unknown>) => cb(em)) },
    };
    svc.listings = {
      find: jest.fn().mockResolvedValue([{ id: 'a', priceAmount: '100.00', priceCurrency: 'USD' }]),
    };
    svc.fx = {
      convert: jest.fn().mockResolvedValue({ value: '4150.00', rate: '41.500000', asOf: at }),
    };
    svc.audit = { record: jest.fn().mockResolvedValue(undefined) };
    svc.logger = { log: jest.fn() };

    const saved = await svc.update({ defaultCurrency: 'UAH' }, actor);

    expect(svc.fx.convert).toHaveBeenCalledWith('100.00', 'USD', 'UAH');
    expect(em.query).toHaveBeenCalledTimes(1); // batched renormalize, not N updates
    expect(em.save).toHaveBeenCalled();
    // Audit written with the transaction's em (second arg).
    expect(svc.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'branding.update' }),
      em,
    );
    expect(saved).toMatchObject({ id: 's1', defaultCurrency: 'UAH' });
  });
});

describe('BrandingService.update audit masking', () => {
  function makeServiceWithAudit(): Svc {
    const svc = makeService();
    const em = {
      save: jest.fn(async (_entity: unknown, x: Record<string, unknown>) => ({ id: 's1', ...x })),
    };
    svc.repo = {
      findOne: jest.fn().mockResolvedValue({ id: 's1', defaultCurrency: 'USD' }),
      manager: { transaction: jest.fn(async (cb: (m: typeof em) => Promise<unknown>) => cb(em)) },
    };
    svc.audit = { record: jest.fn().mockResolvedValue(undefined) };
    svc.logger = { log: jest.fn() };
    return svc;
  }

  function auditedPatch(svc: Svc): Record<string, unknown> {
    const [entry] = svc.audit.record.mock.calls[0] as [
      { diff: { patch: Record<string, unknown> } },
    ];
    return entry.diff.patch;
  }

  it('masks botToken and leadChatId while keeping the rest of the patch', async () => {
    const svc = makeServiceWithAudit();
    const telegram = {
      botToken: '123456:real-secret',
      leadChatId: '-1001234567890',
      channels: [{ chatId: '@autoflow' }],
      autoPublish: true,
    };

    await svc.update({ displayName: 'AutoFlow', telegram }, actor);

    expect(auditedPatch(svc)).toEqual({
      displayName: 'AutoFlow',
      telegram: {
        botToken: '***',
        leadChatId: '***',
        channels: [{ chatId: '@autoflow' }],
        autoPublish: true,
      },
    });
    // The caller's patch is persisted (and left) untouched.
    expect(telegram.botToken).toBe('123456:real-secret');
    expect(telegram.leadChatId).toBe('-1001234567890');
  });

  it('passes cleared telegram fields through — a null is not a secret', async () => {
    const svc = makeServiceWithAudit();

    await svc.update(
      { telegram: { botToken: null, leadChatId: null, channels: [], autoPublish: false } },
      actor,
    );

    expect(auditedPatch(svc)).toEqual({
      telegram: { botToken: null, leadChatId: null, channels: [], autoPublish: false },
    });
  });
});
