import { generateKeyPairSync, sign } from 'node:crypto';
import {
  MonobankSignatureVerifier,
  PUBKEY_REFETCH_INTERVAL_MS,
  verifyMonobankSignature,
} from './monobank-signature';

function keyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return { privateKey, pem: publicKey.export({ type: 'spki', format: 'pem' }).toString() };
}

const body = Buffer.from(
  JSON.stringify({ invoiceId: 'p2_abc', status: 'success', amount: 50000, ccy: 980 }),
);

describe('verifyMonobankSignature', () => {
  const { privateKey, pem } = keyPair();
  const signature = sign('sha256', body, privateKey).toString('base64');

  it('accepts a valid ECDSA-SHA256 signature over the raw body', () => {
    expect(verifyMonobankSignature(pem, body, signature)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const tampered = Buffer.from(body.toString().replace('50000', '5000000'));
    expect(verifyMonobankSignature(pem, tampered, signature)).toBe(false);
  });

  it('rejects a signature made with another key', () => {
    const other = keyPair();
    const foreign = sign('sha256', body, other.privateKey).toString('base64');
    expect(verifyMonobankSignature(pem, body, foreign)).toBe(false);
  });

  it('returns false (never throws) for garbage signatures or keys', () => {
    expect(verifyMonobankSignature(pem, body, '')).toBe(false);
    expect(verifyMonobankSignature(pem, body, 'not-base64!!')).toBe(false);
    expect(verifyMonobankSignature('not a pem', body, signature)).toBe(false);
  });
});

describe('MonobankSignatureVerifier', () => {
  it('fetches the key once and reuses it', async () => {
    const { privateKey, pem } = keyPair();
    const fetchKey = jest.fn().mockResolvedValue(pem);
    const verifier = new MonobankSignatureVerifier(fetchKey);
    const signature = sign('sha256', body, privateKey).toString('base64');

    await expect(verifier.verify(body, signature)).resolves.toBe(true);
    await expect(verifier.verify(body, signature)).resolves.toBe(true);
    expect(fetchKey).toHaveBeenCalledTimes(1);
  });

  it('refetches the key once after a failure (rotation) and accepts the new key', async () => {
    const oldKey = keyPair();
    const newKey = keyPair();
    let clock = 0;
    const fetchKey = jest.fn().mockResolvedValueOnce(oldKey.pem).mockResolvedValueOnce(newKey.pem);
    const verifier = new MonobankSignatureVerifier(fetchKey, () => clock);

    const oldSig = sign('sha256', body, oldKey.privateKey).toString('base64');
    await expect(verifier.verify(body, oldSig)).resolves.toBe(true);

    clock += PUBKEY_REFETCH_INTERVAL_MS;
    const newSig = sign('sha256', body, newKey.privateKey).toString('base64');
    await expect(verifier.verify(body, newSig)).resolves.toBe(true);
    expect(fetchKey).toHaveBeenCalledTimes(2);
  });

  it('rejects a bad signature without refetching more than once per interval', async () => {
    const real = keyPair();
    const attacker = keyPair();
    let clock = 0;
    const fetchKey = jest.fn().mockResolvedValue(real.pem);
    const verifier = new MonobankSignatureVerifier(fetchKey, () => clock);
    const forged = sign('sha256', body, attacker.privateKey).toString('base64');

    await expect(verifier.verify(body, forged)).resolves.toBe(false);
    await expect(verifier.verify(body, forged)).resolves.toBe(false);
    expect(fetchKey).toHaveBeenCalledTimes(1);

    clock += PUBKEY_REFETCH_INTERVAL_MS;
    await expect(verifier.verify(body, forged)).resolves.toBe(false);
    expect(fetchKey).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight key fetch between concurrent webhooks', async () => {
    const { privateKey, pem } = keyPair();
    let resolveKey!: (key: string) => void;
    const fetchKey = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveKey = resolve;
        }),
    );
    const verifier = new MonobankSignatureVerifier(fetchKey);
    const signature = sign('sha256', body, privateKey).toString('base64');

    const pending = [1, 2, 3].map(() => verifier.verify(body, signature));
    resolveKey(pem);

    await expect(Promise.all(pending)).resolves.toEqual([true, true, true]);
    expect(fetchKey).toHaveBeenCalledTimes(1);
  });
});
