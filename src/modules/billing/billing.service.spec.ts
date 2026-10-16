import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import type { BillingSettings } from './billing.config';
import { BillingService } from './billing.service';
import type { BillingInvoice } from './entities/billing-invoice.entity';
import type { MonobankInvoiceStatusInfo } from './monobank.types';

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
      periodMonths: 1,
      pageUrl: 'https://pay.mbnk.biz/p2_abc',
      createdBy: admin.id,
      createdAt: new Date('2026-10-16T08:00:00Z'),
      modifiedAt: null,
      creditedAt: null,
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

  it('audits a reversal of a credited payment without taking the period back', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    const { service, audit } = makeService(db);
    await service.applyStatus(status(), null, NOW);
    const paidUntil = db.state.paidUntil;

    await expect(
      service.applyStatus(
        status({ status: 'reversed', modifiedDate: new Date('2026-10-16T09:30:00Z') }),
        null,
        NOW,
      ),
    ).resolves.toBe('updated');

    expect(db.state.paidUntil).toEqual(paidUntil);
    expect(db.state.invoice.status).toBe('reversed');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'billing.payment_reversed' }),
      expect.anything(),
    );
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

  it('does not audit a reversal of an invoice that was never credited', async () => {
    const db = makeDb(new Date('2026-10-20T00:00:00Z'));
    const { service, audit } = makeService(db);

    await service.applyStatus(status({ status: 'reversed' }), null, NOW);
    expect(audit.record).not.toHaveBeenCalled();
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
