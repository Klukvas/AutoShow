import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import type { BillingSettings } from './billing.config';
import { BillingService } from './billing.service';
import type { BillingInvoice } from './entities/billing-invoice.entity';
import type { MonobankInvoiceStatusInfo } from './monobank.types';
import * as photoStore from '../photo-ai/photo-credits.store';

// Photo-pack effects go to the photo ledger; their SQL is covered by
// photo-credits.integration.spec.ts — here only the calls matter.
jest.mock('../photo-ai/photo-credits.store', () => ({
  ...jest.requireActual('../photo-ai/photo-credits.store'),
  creditPack: jest.fn().mockResolvedValue(true),
  refundPack: jest.fn().mockResolvedValue(true),
}));
const photoLedger = photoStore as jest.Mocked<typeof photoStore>;

const settings: BillingSettings = {
  isEnabled: true,
  monthlyPriceUah: 500,
  periodMonths: 1,
  remindDays: 7,
  graceDays: 10,
  initialPaidUntil: null,
  monobankToken: 'token',
  webhookUrl: 'https://site.example/api/billing/monobank/webhook',
  redirectUrl: 'https://site.example/admin/billing?returned=1',
  photoPacks: {
    isEnabled: false,
    size: 0,
    priceUah: 0,
    freePhotos: 0,
    redirectUrl: 'https://site.example/admin/branding?photoPackReturned=1',
  },
};

const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@x', role: 'admin' };
const NOW = new Date('2026-10-16T09:00:00.000Z');

/**
 * In-memory stand-in for the two billing tables: just enough of the
 * EntityManager / Repository surface the service and the account store use.
 */
function makeDb(paidUntil: Date | null, invoice: Partial<BillingInvoice> = {}) {
  const state = {
    paidUntil,
    invoice: {
      id: 'local-1',
      invoiceId: 'p2_abc',
      amountKop: 50_000,
      ccy: 980,
      status: 'created',
      kind: 'hosting',
      periodMonths: 1,
      photos: null,
      pageUrl: 'https://pay.mbnk.biz/p2_abc',
      createdBy: admin.id,
      createdAt: new Date('2026-10-16T08:00:00Z'),
      modifiedAt: null,
      creditedAt: null,
      creditedFrom: null,
      creditedUntil: null,
      reversedAt: null,
      ...invoice,
    } as BillingInvoice,
    accountWrites: 0,
  };
  const invoiceRepo = {
    findOne: jest.fn(async ({ where }: { where: { invoiceId: string } }) =>
      where.invoiceId === state.invoice.invoiceId ? { ...state.invoice } : null,
    ),
    update: jest.fn(async (_criteria: unknown, patch: Partial<BillingInvoice>) => {
      state.invoice = { ...state.invoice, ...patch };
    }),
    findOneOrFail: jest.fn(async () => ({ ...state.invoice })),
    insert: jest.fn().mockResolvedValue(undefined),
    find: jest.fn(async () => [{ ...state.invoice }]),
  };
  const em = {
    getRepository: () => invoiceRepo,
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('INSERT INTO billing_account')) {
        if (!state.paidUntil) state.paidUntil = params[0] as Date;
        return [];
      }
      if (sql.includes('SELECT paid_until')) {
        return state.paidUntil ? [{ paid_until: state.paidUntil }] : [];
      }
      if (sql.includes('UPDATE billing_account')) {
        state.paidUntil = params[0] as Date;
        state.accountWrites += 1;
        return [];
      }
      throw new Error(`unexpected SQL: ${sql}`);
    }),
  };
  const repo = {
    ...invoiceRepo,
    manager: {
      ...em,
      transaction: jest.fn(async (cb: (m: typeof em) => Promise<unknown>) => cb(em)),
    },
  };
  return { state, repo };
}

function makeService(db: ReturnType<typeof makeDb>, overrides: Partial<BillingSettings> = {}) {
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const monobank = {
    getInvoiceStatus: jest.fn(),
    createInvoice: jest.fn(),
    removeInvoice: jest.fn().mockResolvedValue(undefined),
  };
  const service = new BillingService(
    { ...settings, ...overrides },
    db.repo as never,
    monobank as never,
    audit as never,
  );
  const logger = (service as unknown as { logger: { error: () => void; warn: () => void } }).logger;
  jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  return { service, audit, monobank };
}

function status(overrides: Partial<MonobankInvoiceStatusInfo> = {}): MonobankInvoiceStatusInfo {
  return {
    invoiceId: 'p2_abc',
    status: 'success',
    amount: 50_000,
    ccy: 980,
    modifiedDate: new Date('2026-10-16T08:30:00Z'),
    ...overrides,
  };
}

describe('BillingService.applyStatus (crediting)', () => {
  it('credits a successful payment once: extends paid_until by the invoice period', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    const { service, audit } = makeService(db);

    await expect(service.applyStatus(status(), null, NOW)).resolves.toBe('credited');

    expect(db.state.paidUntil?.toISOString()).toBe('2026-11-20T00:00:00.000Z');
    expect(db.state.invoice.status).toBe('success');
    expect(db.state.invoice.creditedAt).toEqual(NOW);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'billing.payment_credited' }),
      expect.anything(),
    );
  });

  it('is idempotent: a duplicate success webhook does not extend again', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    const { service } = makeService(db);

    await service.applyStatus(status(), null, NOW);
    await expect(service.applyStatus(status(), null, NOW)).resolves.toBe('updated');

    expect(db.state.accountWrites).toBe(1);
    expect(db.state.paidUntil?.toISOString()).toBe('2026-11-20T00:00:00.000Z');
  });

  it('does not credit when the paid amount differs from the invoice', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    const { service, audit } = makeService(db);

    await expect(service.applyStatus(status({ amount: 100 }), null, NOW)).resolves.toBe('mismatch');

    expect(db.state.accountWrites).toBe(0);
    expect(db.state.invoice.creditedAt).toBeNull();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'billing.payment_mismatch' }),
      expect.anything(),
    );
  });

  it('does not credit a payment in another currency', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    const { service } = makeService(db);

    await expect(service.applyStatus(status({ ccy: 840 }), null, NOW)).resolves.toBe('mismatch');
    expect(db.state.accountWrites).toBe(0);
  });

  it('does not credit non-success statuses', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    const { service } = makeService(db);

    for (const s of ['processing', 'hold', 'failure', 'expired'] as const) {
      await service.applyStatus(status({ status: s }), null, NOW);
    }
    expect(db.state.accountWrites).toBe(0);
    expect(db.state.invoice.status).toBe('expired');
  });

  it('ignores an out-of-order (older) status after a newer one was applied', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    const { service } = makeService(db);

    await service.applyStatus(
      status({ modifiedDate: new Date('2026-10-16T08:30:00Z') }),
      null,
      NOW,
    );
    const result = await service.applyStatus(
      status({ status: 'processing', modifiedDate: new Date('2026-10-16T08:29:00Z') }),
      null,
      NOW,
    );

    expect(result).toBe('stale');
    expect(db.state.invoice.status).toBe('success');
  });

  it('credits a success that arrives after an older processing update', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    const { service } = makeService(db);

    await service.applyStatus(
      status({ status: 'processing', modifiedDate: new Date('2026-10-16T08:29:00Z') }),
      null,
      NOW,
    );
    await expect(service.applyStatus(status(), null, NOW)).resolves.toBe('credited');
  });

  it('restarts the period from now for a long-overdue account', async () => {
    const db = makeDb(new Date('2026-06-01T00:00:00Z'));
    const { service } = makeService(db);

    await service.applyStatus(status(), null, NOW);
    expect(db.state.paidUntil?.toISOString()).toBe('2026-11-16T09:00:00.000Z');
  });

  it('unblocks immediately after a credit (status cache is invalidated)', async () => {
    const db = makeDb(new Date('2026-09-01T00:00:00Z'));
    const { service } = makeService(db);

    await expect(service.isBlocked(NOW)).resolves.toBe(true);
    await service.applyStatus(status(), null, NOW);
    await expect(service.isBlocked(NOW)).resolves.toBe(false);
  });
});

describe('BillingService.applyStatus edge cases', () => {
  it('credits a success that carries no modifiedDate (optional in Monobank docs)', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'), {
      modifiedAt: new Date('2026-10-16T08:00:00Z'),
    });
    const { service } = makeService(db);

    await expect(service.applyStatus(status({ modifiedDate: null }), null, NOW)).resolves.toBe(
      'credited',
    );
    expect(db.state.invoice.modifiedAt).toEqual(new Date('2026-10-16T08:00:00Z'));
  });

  it('audits a wrong-amount payment once, however many webhooks repeat it', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    const { service, audit } = makeService(db);

    for (let i = 0; i < 3; i += 1) {
      await expect(service.applyStatus(status({ amount: 100 }), null, NOW)).resolves.toBe(
        'mismatch',
      );
    }
    const mismatchAudits = audit.record.mock.calls.filter(
      ([entry]) => (entry as { action: string }).action === 'billing.payment_mismatch',
    );
    expect(mismatchAudits).toHaveLength(1);
    expect(db.state.accountWrites).toBe(0);
  });

  it('does nothing on a reversal of an invoice that was never credited', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    const { service, audit } = makeService(db);

    await expect(service.applyStatus(status({ status: 'reversed' }), null, NOW)).resolves.toBe(
      'updated',
    );
    expect(audit.record).not.toHaveBeenCalled();
    expect(db.state.accountWrites).toBe(0);
    expect(db.state.paidUntil?.toISOString()).toBe('2026-10-20T00:00:00.000Z');
  });
});

const reversed = (minute: number) =>
  status({ status: 'reversed', modifiedDate: new Date(`2026-10-16T09:${minute}:00Z`) });

describe('BillingService refund rollback', () => {
  it('rolls paid_until back by exactly what the refunded payment added', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    const { service, audit } = makeService(db);
    await service.applyStatus(status(), null, NOW);
    expect(db.state.invoice.creditedFrom?.toISOString()).toBe('2026-10-20T00:00:00.000Z');
    expect(db.state.invoice.creditedUntil?.toISOString()).toBe('2026-11-20T00:00:00.000Z');

    await expect(service.applyStatus(reversed(30), null, NOW)).resolves.toBe('reversed');

    expect(db.state.paidUntil?.toISOString()).toBe('2026-10-20T00:00:00.000Z');
    expect(db.state.invoice.reversedAt).toEqual(NOW);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'billing.payment_reversed',
        diff: expect.objectContaining({
          paidUntilBefore: '2026-11-20T00:00:00.000Z',
          paidUntilAfter: '2026-10-20T00:00:00.000Z',
        }),
      }),
      expect.anything(),
    );
  });

  it('keeps a later stacked payment when an earlier one is refunded', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    const { service } = makeService(db);
    await service.applyStatus(status(), null, NOW); // → 2026-11-20
    db.state.paidUntil = new Date('2026-12-20T00:00:00Z'); // a later payment stacked a month

    await service.applyStatus(reversed(30), null, NOW);

    // The refund takes back the 31 days that payment added (20 Oct → 20 Nov);
    // the later 30-day month stays, so the result is 19 Nov, not 20 Oct.
    expect(db.state.paidUntil?.toISOString()).toBe('2026-11-19T00:00:00.000Z');
  });

  it('rolls a restart-from-now credit back to the credit instant, not the old date', async () => {
    const db = makeDb(new Date('2026-06-01T00:00:00Z'));
    const { service } = makeService(db);
    await service.applyStatus(status(), null, NOW); // restart: now + 1 month
    expect(db.state.invoice.creditedFrom).toEqual(NOW); // credit instant, not 1 Jun

    await service.applyStatus(reversed(30), null, NOW);

    expect(db.state.paidUntil).toEqual(NOW);
  });

  it('keeps a later stacked payment when an earlier restart-from-now credit is refunded', async () => {
    const db = makeDb(new Date('2026-06-01T00:00:00Z'));
    const { service } = makeService(db);
    await service.applyStatus(status(), null, NOW); // 16 Oct 09:00 → 16 Nov 09:00
    db.state.paidUntil = new Date('2026-12-16T09:00:00Z'); // a later payment stacked a month

    await service.applyStatus(reversed(30), null, NOW);

    // Only the refunded 31 days come off; the forgiven June–October gap does not.
    expect(db.state.paidUntil?.toISOString()).toBe('2026-11-15T09:00:00.000Z');
  });

  it('rolls back once for duplicate and out-of-order reversed updates', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    const { service, audit } = makeService(db);
    await service.applyStatus(status(), null, NOW);

    await service.applyStatus(reversed(30), null, NOW);
    await service.applyStatus(reversed(30), null, NOW); // duplicate webhook
    await service.applyStatus(reversed(31), null, NOW); // later sync, same status
    // A dateless success slipping in is ignored; reversed again is a no-op.
    await expect(service.applyStatus(status({ modifiedDate: null }), null, NOW)).resolves.toBe(
      'stale',
    );
    await service.applyStatus(reversed(32), null, NOW);

    expect(db.state.paidUntil?.toISOString()).toBe('2026-10-20T00:00:00.000Z');
    expect(db.state.accountWrites).toBe(2); // one credit + one rollback
    const reversals = audit.record.mock.calls.filter(
      ([entry]) => (entry as { action: string }).action === 'billing.payment_reversed',
    );
    expect(reversals).toHaveLength(1);
  });

  it('treats a stored reversal as final: a later success neither relabels nor credits', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    const { service, audit } = makeService(db);
    await service.applyStatus(status(), null, NOW);
    await service.applyStatus(reversed(30), null, NOW);
    const writes = db.state.accountWrites;
    audit.record.mockClear();

    await expect(
      service.applyStatus(status({ modifiedDate: new Date('2026-10-16T09:45:00Z') }), null, NOW),
    ).resolves.toBe('stale');

    expect(db.state.invoice.status).toBe('reversed');
    expect(db.state.accountWrites).toBe(writes);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('falls back to the invoice period for credits made before amounts were stored', async () => {
    const db = makeDb(new Date('2026-03-31T12:00:00Z'), {
      status: 'success',
      creditedAt: new Date('2026-02-01T00:00:00Z'),
      modifiedAt: new Date('2026-02-01T00:00:00Z'),
    });
    const { service } = makeService(db);

    await service.applyStatus(reversed(30), null, NOW);

    // 31 Mar − 1 month clamps to the end of February.
    expect(db.state.paidUntil?.toISOString()).toBe('2026-02-28T12:00:00.000Z');
  });

  it('undoes a month-end credit exactly (31 Jan → 28 Feb → 31 Jan)', async () => {
    const db = makeDb(new Date('2026-01-31T12:00:00Z'));
    const { service } = makeService(db);
    const january = new Date('2026-01-20T00:00:00Z');
    await service.applyStatus(status(), null, january);
    expect(db.state.paidUntil?.toISOString()).toBe('2026-02-28T12:00:00.000Z');

    await service.applyStatus(reversed(30), null, january);

    expect(db.state.paidUntil?.toISOString()).toBe('2026-01-31T12:00:00.000Z');
  });

  it('applies a blocking rollback to the guard immediately (cache invalidated)', async () => {
    // Blocked since 15 Oct; the credit stacks (5 Oct → 5 Nov), the refund undoes it.
    const db = makeDb(new Date('2026-10-05T00:00:00Z'));
    const { service } = makeService(db);
    await service.applyStatus(status(), null, NOW);
    await expect(service.isBlocked(NOW)).resolves.toBe(false); // now cached

    await service.applyStatus(reversed(30), null, NOW);

    await expect(service.isBlocked(NOW)).resolves.toBe(true);
  });
});

describe('BillingService.listInvoices', () => {
  it('never reports an uncredited success (amount mismatch) as paid', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    const { service } = makeService(db);
    await service.applyStatus(status({ amount: 100 }), null, NOW);

    const [view] = await service.listInvoices();
    expect(view).toMatchObject({ status: 'mismatch', creditedAt: null, pageUrl: null });
  });

  it('reports a credited success as success', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    const { service } = makeService(db);
    await service.applyStatus(status(), null, NOW);

    const [view] = await service.listInvoices();
    expect(view.status).toBe('success');
  });

  it('shows an unpaid invoice past its validity as expired, without a payment link', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'), {
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });
    const { service } = makeService(db);

    const [view] = await service.listInvoices();
    expect(view).toMatchObject({ status: 'expired', pageUrl: null });
  });

  it('keeps the payment link while the invoice is still valid', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'), {
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
    });
    const { service } = makeService(db);

    const [view] = await service.listInvoices();
    expect(view).toMatchObject({ status: 'created', pageUrl: 'https://pay.mbnk.biz/p2_abc' });
  });
});

describe('BillingService.handleWebhook', () => {
  it('ignores webhooks for unknown invoices without calling Monobank', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    const { service, monobank } = makeService(db);

    await expect(service.handleWebhook('p2_unknown')).resolves.toBe('ignored');
    expect(monobank.getInvoiceStatus).not.toHaveBeenCalled();
  });

  it('uses the Monobank status API as the source of truth', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    const { service, monobank } = makeService(db);
    monobank.getInvoiceStatus.mockResolvedValue(status({ status: 'failure' }));

    await expect(service.handleWebhook('p2_abc')).resolves.toBe('updated');
    expect(monobank.getInvoiceStatus).toHaveBeenCalledWith('p2_abc');
    expect(db.state.accountWrites).toBe(0);
  });
});

describe('BillingService status payloads', () => {
  it('editor status carries only enabled/blocked — no price, dates or reminders', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    const { service } = makeService(db);

    const editor = await service.getEditorStatus(NOW);
    expect(editor).toEqual({ enabled: true, blocked: false });
  });

  it('admin status carries the full picture', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    const { service } = makeService(db);

    await expect(service.getAdminStatus(NOW)).resolves.toEqual({
      enabled: true,
      blocked: false,
      state: 'due_soon',
      paidUntil: '2026-10-20T00:00:00.000Z',
      blockAt: '2026-10-30T00:00:00.000Z',
      daysLeft: 4,
      daysUntilBlock: 14,
      monthlyPriceUah: 500,
      periodMonths: 1,
      amountUah: 500,
      remindDays: 7,
      graceDays: 10,
    });
  });

  it('reports disabled billing without touching the database', async () => {
    const db = makeDb(null);
    const { service } = makeService(db, { isEnabled: false });

    await expect(service.getAdminStatus(NOW)).resolves.toEqual({ enabled: false, blocked: false });
    await expect(service.isBlocked(NOW)).resolves.toBe(false);
    expect(db.repo.manager.query).not.toHaveBeenCalled();
  });

  it('seeds paid_until on first use from BILLING_INITIAL_PAID_UNTIL', async () => {
    const db = makeDb(null);
    const { service } = makeService(db, { initialPaidUntil: new Date('2026-12-01T00:00:00Z') });

    const result = await service.getAdminStatus(NOW);
    expect(result).toMatchObject({ paidUntil: '2026-12-01T00:00:00.000Z', state: 'active' });
  });

  it('seeds paid_until = now + one period when no initial date is configured', async () => {
    const db = makeDb(null);
    const { service } = makeService(db);

    const result = await service.getAdminStatus(NOW);
    expect(result).toMatchObject({ paidUntil: '2026-11-16T09:00:00.000Z' });
  });
});

describe('BillingService.createInvoice', () => {
  it('creates a Monobank invoice for price × period in kopecks and stores it', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    const { service, monobank, audit } = makeService(db, { periodMonths: 3 });
    monobank.createInvoice.mockResolvedValue({
      invoiceId: 'p2_new',
      pageUrl: 'https://pay.mbnk.biz/p2_new',
    });

    await expect(service.createInvoice(admin)).resolves.toEqual({
      invoiceId: 'p2_new',
      pageUrl: 'https://pay.mbnk.biz/p2_new',
    });
    expect(monobank.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ amountKop: 150_000 }),
    );
    expect(db.repo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: 'p2_new',
        amountKop: 150_000,
        ccy: 980,
        periodMonths: 3,
        status: 'created',
        createdBy: admin.id,
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'billing.invoice_created' }),
      expect.anything(),
    );
    expect(monobank.removeInvoice).not.toHaveBeenCalled();
  });

  it('cancels the Monobank invoice and rethrows when storing it fails', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    db.repo.insert.mockRejectedValueOnce(new Error('db down'));
    const { service, monobank } = makeService(db);
    monobank.createInvoice.mockResolvedValue({
      invoiceId: 'p2_orphan',
      pageUrl: 'https://pay.mbnk.biz/p2_orphan',
    });

    await expect(service.createInvoice(admin)).rejects.toThrow('db down');
    expect(monobank.removeInvoice).toHaveBeenCalledWith('p2_orphan');
  });

  it('does not cancel the invoice when the row was in fact stored (lost commit ack)', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'), { invoiceId: 'p2_kept' });
    db.repo.insert.mockRejectedValueOnce(new Error('connection reset after commit'));
    const { service, monobank } = makeService(db);
    monobank.createInvoice.mockResolvedValue({
      invoiceId: 'p2_kept',
      pageUrl: 'https://pay.mbnk.biz/p2_kept',
    });

    await expect(service.createInvoice(admin)).rejects.toThrow('connection reset');
    expect(monobank.removeInvoice).not.toHaveBeenCalled();
  });

  it('still rethrows the original error when cancelling the orphan also fails', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    db.repo.insert.mockRejectedValueOnce(new Error('db down'));
    const { service, monobank } = makeService(db);
    monobank.createInvoice.mockResolvedValue({
      invoiceId: 'p2_orphan',
      pageUrl: 'https://pay.mbnk.biz/p2_orphan',
    });
    monobank.removeInvoice.mockRejectedValueOnce(new Error('mono down'));

    await expect(service.createInvoice(admin)).rejects.toThrow('db down');
  });

  it('refuses when billing is disabled', async () => {
    const db = makeDb(null);
    const { service, monobank } = makeService(db, { isEnabled: false });

    await expect(service.createInvoice(admin)).rejects.toThrow('вимкнено');
    expect(monobank.createInvoice).not.toHaveBeenCalled();
  });
});

const managedPacks = {
  photoPacks: { ...settings.photoPacks, isEnabled: true, size: 50, priceUah: 300 },
};
const packInvoice = {
  kind: 'photo_pack' as const,
  photos: 50,
  periodMonths: null,
  amountKop: 30_000,
};
const packStatus = (overrides: Partial<MonobankInvoiceStatusInfo> = {}) =>
  status({ amount: 30_000, ...overrides });

describe('BillingService photo packs', () => {
  beforeEach(() => jest.clearAllMocks());

  it('credits a paid pack to the photo balance and leaves hosting untouched', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'), packInvoice);
    const { service, audit } = makeService(db, managedPacks);

    await expect(service.applyStatus(packStatus(), null, NOW)).resolves.toBe('credited');

    expect(photoLedger.creditPack).toHaveBeenCalledWith(expect.anything(), 'p2_abc', 50, null);
    expect(db.state.accountWrites).toBe(0);
    expect(db.state.paidUntil?.toISOString()).toBe('2026-10-20T00:00:00.000Z');
    expect(db.state.invoice.creditedAt).toEqual(NOW);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'billing.photo_pack_credited' }),
      expect.anything(),
    );
  });

  it('credits a pack once however many webhooks/syncs repeat', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'), packInvoice);
    const { service } = makeService(db, managedPacks);
    await service.applyStatus(packStatus(), null, NOW);
    await service.applyStatus(packStatus(), null, NOW);
    await service.applyStatus(packStatus({ modifiedDate: null }), null, NOW);
    expect(photoLedger.creditPack).toHaveBeenCalledTimes(1);
  });

  it('does not credit a pack paid with the wrong amount', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'), packInvoice);
    const { service, audit } = makeService(db, managedPacks);
    await expect(service.applyStatus(packStatus({ amount: 100 }), null, NOW)).resolves.toBe(
      'mismatch',
    );
    expect(photoLedger.creditPack).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'billing.payment_mismatch' }),
      expect.anything(),
    );
  });

  it('removes a refunded pack once and never touches paid_until', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'), packInvoice);
    const { service, audit } = makeService(db, managedPacks);
    await service.applyStatus(packStatus(), null, NOW);
    const refund = (minute: number) =>
      packStatus({ status: 'reversed', modifiedDate: new Date(`2026-10-16T09:${minute}:00Z`) });

    await expect(service.applyStatus(refund(30), null, NOW)).resolves.toBe('reversed');
    await service.applyStatus(refund(30), null, NOW);
    await service.applyStatus(refund(31), null, NOW);

    expect(photoLedger.refundPack).toHaveBeenCalledTimes(1);
    expect(photoLedger.refundPack).toHaveBeenCalledWith(expect.anything(), 'p2_abc', 50, null);
    expect(db.state.accountWrites).toBe(0);
    expect(
      audit.record.mock.calls.filter(
        ([entry]) => (entry as { action: string }).action === 'billing.photo_pack_reversed',
      ),
    ).toHaveLength(1);
  });

  it('processes webhooks for packs while hosting billing is disabled', async () => {
    const db = makeDb(null, packInvoice);
    const { service, monobank } = makeService(db, { isEnabled: false, ...managedPacks });
    monobank.getInvoiceStatus.mockResolvedValue(packStatus());

    expect(service.isMonobankConfigured).toBe(true);
    await expect(service.handleWebhook('p2_abc')).resolves.toBe('credited');
    await expect(service.isBlocked(NOW)).resolves.toBe(false); // hosting still off
  });

  it('still credits a pack paid after switching back to own_key (token still configured)', async () => {
    const db = makeDb(null, packInvoice);
    const { service, monobank } = makeService(db, { isEnabled: false }); // packs off too
    monobank.getInvoiceStatus.mockResolvedValue(packStatus());
    await expect(service.handleWebhook('p2_abc')).resolves.toBe('credited');
    expect(photoLedger.creditPack).toHaveBeenCalledTimes(1);
  });

  it('ignores webhooks only when no Monobank token is configured', async () => {
    const db = makeDb(null, packInvoice);
    const { service, monobank } = makeService(db, { isEnabled: false, monobankToken: '' });
    await expect(service.handleWebhook('p2_abc')).resolves.toBe('ignored');
    expect(monobank.getInvoiceStatus).not.toHaveBeenCalled();
  });

  it('refuses to sync a hosting invoice while hosting billing is off (managed packs on)', async () => {
    const db = makeDb(null); // hosting invoice fixture
    const { service, monobank } = makeService(db, { isEnabled: false, ...managedPacks });
    await expect(service.syncInvoice('p2_abc', admin, 'hosting')).rejects.toThrow(
      'Оплату обслуговування вимкнено',
    );
    await expect(service.syncInvoice('p2_abc', admin)).rejects.toThrow(
      'Оплату обслуговування вимкнено',
    );
    expect(monobank.getInvoiceStatus).not.toHaveBeenCalled();
    expect(db.state.accountWrites).toBe(0);
  });

  it('ignores a hosting webhook while hosting billing is off, but still credits packs', async () => {
    const hosting = makeDb(null); // hosting invoice fixture, no account row
    const off = makeService(hosting, { isEnabled: false, ...managedPacks });
    await expect(off.service.handleWebhook('p2_abc')).resolves.toBe('ignored');
    expect(off.monobank.getInvoiceStatus).not.toHaveBeenCalled();
    expect(hosting.state.accountWrites).toBe(0);
    expect(hosting.state.paidUntil).toBeNull();

    const pack = makeDb(null, packInvoice);
    const packs = makeService(pack, { isEnabled: false, ...managedPacks });
    packs.monobank.getInvoiceStatus.mockResolvedValue(packStatus());
    await expect(packs.service.handleWebhook('p2_abc')).resolves.toBe('credited');
    expect(photoLedger.creditPack).toHaveBeenCalledTimes(1);
  });

  it('never credits or reverses hosting time while hosting billing is off', async () => {
    const db = makeDb(null);
    const { service } = makeService(db, { isEnabled: false, ...managedPacks });
    await expect(service.applyStatus(status(), null, NOW)).resolves.toBe('updated');
    await expect(
      service.applyStatus(
        status({ status: 'reversed', modifiedDate: new Date('2026-10-16T09:30:00Z') }),
        null,
        NOW,
      ),
    ).resolves.toBe('updated');
    expect(db.state.accountWrites).toBe(0);
    expect(db.state.paidUntil).toBeNull();
    expect(db.state.invoice.creditedAt).toBeNull();
  });

  it('syncs a pack invoice while hosting billing is off', async () => {
    const db = makeDb(null, packInvoice);
    const { service, monobank } = makeService(db, { isEnabled: false, ...managedPacks });
    monobank.getInvoiceStatus.mockResolvedValue(packStatus());
    await expect(service.syncInvoice('p2_abc', admin, 'photo_pack')).resolves.toMatchObject({
      status: 'success',
    });
    expect(photoLedger.creditPack).toHaveBeenCalledTimes(1);
  });

  it('stores a pack invoice with its photo count and the photo-AI return page', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    const { service, monobank } = makeService(db, managedPacks);
    monobank.createInvoice.mockResolvedValue({
      invoiceId: 'p2_pack',
      pageUrl: 'https://pay.mbnk.biz/p2_pack',
    });

    await service.createMonobankInvoice(
      {
        kind: 'photo_pack',
        amountKop: 30_000,
        destination: 'pack',
        periodMonths: null,
        photos: 50,
        redirectUrl: managedPacks.photoPacks.redirectUrl,
      },
      admin,
    );

    expect(monobank.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        amountKop: 30_000,
        redirectUrl: managedPacks.photoPacks.redirectUrl,
      }),
    );
    expect(db.repo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'photo_pack', photos: 50, periodMonths: null }),
    );
  });

  it('syncs only invoices of the requested kind', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'), packInvoice);
    const { service } = makeService(db, managedPacks);
    db.repo.findOne.mockImplementation(
      async ({ where }: { where: { invoiceId: string; kind?: string } }) =>
        where.kind && where.kind !== 'photo_pack' ? null : { ...db.state.invoice },
    );
    await expect(service.syncInvoice('p2_abc', admin, 'hosting')).rejects.toThrow('не знайдено');
  });
});
