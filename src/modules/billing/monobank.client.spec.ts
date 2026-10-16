import axios from 'axios';
import type { BillingSettings } from './billing.config';
import { MonobankApiError, MonobankClient } from './monobank.client';

jest.mock('axios');
const request = axios.request as jest.MockedFunction<typeof axios.request>;

const TOKEN = 'secret-mono-token';
const settings: BillingSettings = {
  isEnabled: true,
  monthlyPriceUah: 500,
  periodMonths: 1,
  remindDays: 7,
  graceDays: 10,
  initialPaidUntil: null,
  monobankToken: TOKEN,
  webhookUrl: 'https://site.example/api/billing/monobank/webhook',
  redirectUrl: 'https://site.example/admin/billing?returned=1',
};

function respond(status: number, data: unknown) {
  request.mockResolvedValueOnce({ status, data } as never);
}

describe('MonobankClient', () => {
  let errorSpy: jest.SpyInstance;
  const client = new MonobankClient(settings);

  beforeEach(() => {
    request.mockReset();
    errorSpy = jest
      .spyOn((client as unknown as { logger: { error: () => void } }).logger, 'error')
      .mockImplementation(() => undefined);
  });
  afterEach(() => errorSpy.mockRestore());

  it('creates an invoice with amount in kopecks, UAH, our URLs and the X-Token header', async () => {
    respond(200, { invoiceId: 'p2_9ZgpZVsl3', pageUrl: 'https://pay.mbnk.biz/p2_9ZgpZVsl3' });

    const created = await client.createInvoice({
      amountKop: 50_000,
      reference: 'ref-1',
      destination: 'Hosting',
    });

    expect(created).toEqual({
      invoiceId: 'p2_9ZgpZVsl3',
      pageUrl: 'https://pay.mbnk.biz/p2_9ZgpZVsl3',
    });
    const call = request.mock.calls[0][0];
    expect(call.url).toBe('https://api.monobank.ua/api/merchant/invoice/create');
    expect(call.method).toBe('POST');
    expect(call.headers).toEqual({ 'X-Token': TOKEN });
    expect(call.timeout).toBeGreaterThan(0);
    expect(call.data).toMatchObject({
      amount: 50_000,
      ccy: 980,
      merchantPaymInfo: { reference: 'ref-1', destination: 'Hosting' },
      redirectUrl: settings.redirectUrl,
      webHookUrl: settings.webhookUrl,
    });
  });

  it('rejects a create response with a non-https pageUrl', async () => {
    respond(200, { invoiceId: 'p2_x', pageUrl: 'javascript:alert(1)' });
    await expect(
      client.createInvoice({ amountKop: 1, reference: 'r', destination: 'd' }),
    ).rejects.toBeInstanceOf(MonobankApiError);
  });

  it('parses the status response and validates its shape', async () => {
    respond(200, {
      invoiceId: 'p2_x',
      status: 'success',
      amount: 50_000,
      ccy: 980,
      modifiedDate: '2026-10-16T10:00:00Z',
    });
    const info = await client.getInvoiceStatus('p2_x');
    expect(info).toEqual({
      invoiceId: 'p2_x',
      status: 'success',
      amount: 50_000,
      ccy: 980,
      modifiedDate: new Date('2026-10-16T10:00:00Z'),
    });
    expect(request.mock.calls[0][0].url).toBe(
      'https://api.monobank.ua/api/merchant/invoice/status?invoiceId=p2_x',
    );

    respond(200, { invoiceId: 'p2_x', status: 'paid-ish', amount: '50000', ccy: 980 });
    await expect(client.getInvoiceStatus('p2_x')).rejects.toBeInstanceOf(MonobankApiError);
  });

  it('accepts a status response without modifiedDate (optional field)', async () => {
    respond(200, { invoiceId: 'p2_x', status: 'success', amount: 50_000, ccy: 980 });
    await expect(client.getInvoiceStatus('p2_x')).resolves.toMatchObject({
      status: 'success',
      modifiedDate: null,
    });

    respond(200, {
      invoiceId: 'p2_x',
      status: 'success',
      amount: 50_000,
      ccy: 980,
      modifiedDate: 'not-a-date',
    });
    await expect(client.getInvoiceStatus('p2_x')).rejects.toBeInstanceOf(MonobankApiError);
  });

  it('cancels an invoice via invoice/remove', async () => {
    respond(200, {});
    await client.removeInvoice('p2_x');
    const call = request.mock.calls[0][0];
    expect(call.url).toBe('https://api.monobank.ua/api/merchant/invoice/remove');
    expect(call.method).toBe('POST');
    expect(call.data).toEqual({ invoiceId: 'p2_x' });
    expect(call.headers).toEqual({ 'X-Token': TOKEN });
  });

  it('rejects a status response for a different invoice', async () => {
    respond(200, {
      invoiceId: 'p2_other',
      status: 'success',
      amount: 1,
      ccy: 980,
      modifiedDate: '2026-10-16T10:00:00Z',
    });
    await expect(client.getInvoiceStatus('p2_x')).rejects.toBeInstanceOf(MonobankApiError);
  });

  it('decodes the base64 PEM public key', async () => {
    const pem = '-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----\n';
    respond(200, { key: Buffer.from(pem).toString('base64') });
    await expect(client.getPublicKey()).resolves.toBe(pem);
  });

  it('never puts the token into errors or logs (HTTP error and network error)', async () => {
    respond(403, { errCode: 'FORBIDDEN', errText: 'forbidden' });
    const httpErr = await client.getPublicKey().catch((e: unknown) => e);
    expect(httpErr).toBeInstanceOf(MonobankApiError);
    expect((httpErr as Error).message).toContain('HTTP 403 (FORBIDDEN)');

    const networkError = Object.assign(new Error('timeout of 15000ms exceeded'), {
      config: { headers: { 'X-Token': TOKEN } },
    });
    request.mockRejectedValueOnce(networkError);
    const netErr = await client.getPublicKey().catch((e: unknown) => e);
    expect(netErr).toBeInstanceOf(MonobankApiError);

    const everything = JSON.stringify([
      (httpErr as Error).message,
      (netErr as Error).message,
      errorSpy.mock.calls,
    ]);
    expect(everything).not.toContain(TOKEN);
  });
});
