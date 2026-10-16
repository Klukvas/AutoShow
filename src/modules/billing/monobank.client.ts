import { Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { BILLING_SETTINGS, type BillingSettings } from './billing.config';
import { MonobankSignatureVerifier } from './monobank-signature';
import {
  parseCreatedInvoice,
  parseInvoiceStatus,
  parsePublicKey,
  UAH_CCY,
  type MonobankCreatedInvoice,
  type MonobankInvoiceStatusInfo,
} from './monobank.types';

export const MONOBANK_API_BASE = 'https://api.monobank.ua';
const REQUEST_TIMEOUT_MS = 15_000;
/** How long a payment page stays valid (Monobank `validity`, seconds). */
export const INVOICE_VALIDITY_SECONDS = 24 * 60 * 60;

export interface CreateInvoiceInput {
  amountKop: number;
  reference: string;
  destination: string;
}

/** Monobank call failed — message is safe to log (never contains the token). */
export class MonobankApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MonobankApiError';
  }
}

/**
 * Thin Monobank acquiring wrapper. The X-Token lives in request headers, and
 * raw axios errors carry the request config — so they are never logged or
 * rethrown; every failure is reduced to path + status + Monobank's errCode.
 */
@Injectable()
export class MonobankClient {
  private readonly logger = new Logger(MonobankClient.name);
  private readonly verifier = new MonobankSignatureVerifier(() => this.getPublicKey());

  constructor(@Inject(BILLING_SETTINGS) private readonly settings: BillingSettings) {}

  async createInvoice(input: CreateInvoiceInput): Promise<MonobankCreatedInvoice> {
    const body = await this.request('POST', '/api/merchant/invoice/create', {
      amount: input.amountKop,
      ccy: UAH_CCY,
      merchantPaymInfo: { reference: input.reference, destination: input.destination },
      redirectUrl: this.settings.redirectUrl,
      webHookUrl: this.settings.webhookUrl,
      validity: INVOICE_VALIDITY_SECONDS,
      paymentType: 'debit',
    });
    const parsed = parseCreatedInvoice(body);
    if (!parsed) throw this.fail('invoice/create', 'unexpected response shape');
    return parsed;
  }

  async getInvoiceStatus(invoiceId: string): Promise<MonobankInvoiceStatusInfo> {
    const path = `/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`;
    const parsed = parseInvoiceStatus(await this.request('GET', path));
    if (!parsed || parsed.invoiceId !== invoiceId) {
      throw this.fail('invoice/status', 'unexpected response shape');
    }
    return parsed;
  }

  /** Cancels an unpaid invoice so its payment page stops accepting money. */
  async removeInvoice(invoiceId: string): Promise<void> {
    await this.request('POST', '/api/merchant/invoice/remove', { invoiceId });
  }

  async getPublicKey(): Promise<string> {
    const pem = parsePublicKey(await this.request('GET', '/api/merchant/pubkey'));
    if (!pem) throw this.fail('pubkey', 'unexpected response shape');
    return pem;
  }

  /** Verifies a webhook `X-Sign` against the (cached, rotation-aware) public key. */
  verifyWebhook(rawBody: Buffer, signatureBase64: string): Promise<boolean> {
    return this.verifier.verify(rawBody, signatureBase64);
  }

  private async request(method: 'GET' | 'POST', path: string, data?: unknown): Promise<unknown> {
    const endpoint = path.split('?')[0];
    let status: number;
    let body: unknown;
    try {
      const res = await axios.request<unknown>({
        method,
        url: `${MONOBANK_API_BASE}${path}`,
        data,
        headers: { 'X-Token': this.settings.monobankToken },
        timeout: REQUEST_TIMEOUT_MS,
        validateStatus: () => true,
      });
      status = res.status;
      body = res.data;
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown network error';
      throw this.fail(endpoint, `network error: ${reason}`);
    }
    if (status < 200 || status >= 300) {
      throw this.fail(endpoint, `HTTP ${status}${describeMonobankError(body)}`);
    }
    return body;
  }

  private fail(endpoint: string, reason: string): MonobankApiError {
    this.logger.error({ endpoint, reason }, 'Monobank API call failed');
    return new MonobankApiError(`Monobank ${endpoint} failed: ${reason}`);
  }
}

function describeMonobankError(body: unknown): string {
  if (typeof body !== 'object' || body === null) return '';
  const { errCode } = body as Record<string, unknown>;
  return typeof errCode === 'string' ? ` (${errCode.slice(0, 64)})` : '';
}
