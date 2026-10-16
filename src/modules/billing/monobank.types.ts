/**
 * Monobank acquiring (Plata by mono) response shapes and their validators.
 * Everything coming from api.monobank.ua — or posted to our webhook — is
 * external data: parse it into these types, never cast it.
 */

export const MONOBANK_INVOICE_STATUSES = [
  'created',
  'processing',
  'hold',
  'success',
  'failure',
  'reversed',
  'expired',
] as const;

export type MonobankInvoiceStatus = (typeof MONOBANK_INVOICE_STATUSES)[number];

/** ISO 4217 numeric code for UAH. */
export const UAH_CCY = 980;

export interface MonobankCreatedInvoice {
  invoiceId: string;
  pageUrl: string;
}

export interface MonobankInvoiceStatusInfo {
  invoiceId: string;
  status: MonobankInvoiceStatus;
  amount: number;
  ccy: number;
  /**
   * When Monobank last changed this invoice — orders out-of-order updates.
   * Optional in Monobank's InvoiceStatusResponse, so absent → null.
   */
  modifiedDate: Date | null;
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const INVOICE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidInvoiceId(value: unknown): value is string {
  return typeof value === 'string' && INVOICE_ID_RE.test(value);
}

function isMonobankStatus(value: unknown): value is MonobankInvoiceStatus {
  return (
    typeof value === 'string' && (MONOBANK_INVOICE_STATUSES as readonly string[]).includes(value)
  );
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function parseCreatedInvoice(body: unknown): MonobankCreatedInvoice | null {
  if (!isObject(body)) return null;
  const { invoiceId, pageUrl } = body;
  if (!isValidInvoiceId(invoiceId) || !isHttpsUrl(pageUrl)) return null;
  return { invoiceId, pageUrl };
}

export function parseInvoiceStatus(body: unknown): MonobankInvoiceStatusInfo | null {
  if (!isObject(body)) return null;
  const { invoiceId, status, amount, ccy, modifiedDate } = body;
  if (!isValidInvoiceId(invoiceId) || !isMonobankStatus(status)) return null;
  if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(ccy)) return null;
  const modified = parseOptionalDate(modifiedDate);
  if (modified === undefined) return null;
  return {
    invoiceId,
    status,
    amount: amount as number,
    ccy: ccy as number,
    modifiedDate: modified,
  };
}

/** null when absent; undefined (= reject the payload) when present but not a valid date. */
function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** `GET /api/merchant/pubkey` → `{ key: base64(PEM) }`. Returns the PEM text. */
export function parsePublicKey(body: unknown): string | null {
  if (!isObject(body) || typeof body.key !== 'string' || !body.key) return null;
  const pem = Buffer.from(body.key, 'base64').toString('utf8');
  return pem.includes('BEGIN PUBLIC KEY') ? pem : null;
}

/** Only the invoice id is read from a webhook body — the status API is the truth. */
export function parseWebhookInvoiceId(rawBody: Buffer): string | null {
  try {
    const body: unknown = JSON.parse(rawBody.toString('utf8'));
    return isObject(body) && isValidInvoiceId(body.invoiceId) ? body.invoiceId : null;
  } catch {
    return null;
  }
}
