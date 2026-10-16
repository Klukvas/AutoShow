import { verify } from 'node:crypto';

/**
 * Monobank signs each webhook body with ECDSA (SHA-256) and sends the
 * base64 DER signature in `X-Sign`. Any malformed key or signature is simply
 * "not verified" — never an exception that could turn into a 500.
 */
export function verifyMonobankSignature(
  publicKeyPem: string,
  rawBody: Buffer,
  signatureBase64: string,
): boolean {
  if (!signatureBase64) return false;
  try {
    return verify('sha256', rawBody, publicKeyPem, Buffer.from(signatureBase64, 'base64'));
  } catch {
    return false;
  }
}

/** Min interval between forced key refetches: bad signatures must not become a fetch amplifier. */
export const PUBKEY_REFETCH_INTERVAL_MS = 60_000;

/**
 * Caches Monobank's webhook public key. On a failed check it refetches the
 * key once (Monobank may rotate it) and retries — at most once per interval.
 */
export class MonobankSignatureVerifier {
  private cachedKey: string | null = null;
  private lastFetchAt = 0;
  /** Shared by concurrent callers so a burst of webhooks triggers one key fetch. */
  private inFlight: Promise<string> | null = null;

  constructor(
    private readonly fetchKey: () => Promise<string>,
    private readonly now: () => number = Date.now,
  ) {}

  async verify(rawBody: Buffer, signatureBase64: string): Promise<boolean> {
    const firstKey = this.cachedKey ?? (await this.refresh());
    if (verifyMonobankSignature(firstKey, rawBody, signatureBase64)) return true;

    const isRefetchAllowed = this.now() - this.lastFetchAt >= PUBKEY_REFETCH_INTERVAL_MS;
    if (!isRefetchAllowed) return false;
    const rotatedKey = await this.refresh();
    if (rotatedKey === firstKey) return false;
    return verifyMonobankSignature(rotatedKey, rawBody, signatureBase64);
  }

  private refresh(): Promise<string> {
    if (!this.inFlight) {
      this.inFlight = this.fetchKey()
        .then((key) => {
          this.cachedKey = key;
          this.lastFetchAt = this.now();
          return key;
        })
        .finally(() => {
          this.inFlight = null;
        });
    }
    return this.inFlight;
  }
}
