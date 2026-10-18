import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// The AAD predates the shared module: stored ciphertexts are bound to it, so it
// must not change without re-encrypting them.
const AAD = Buffer.from('autoflow:photo-ai:site-owner-key:v1:1');
export function encryptionKey(value: string | undefined): Buffer | null {
  if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value)) return null;
  const decoded = Buffer.from(value, 'base64');
  return decoded.length === 32 && decoded.toString('base64') === value ? decoded : null;
}
export function encryptCredential(credential: string, master: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', master, iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(credential, 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    ciphertext.toString('base64'),
  ].join('.');
}
export function decryptCredential(envelope: string, master: Buffer): string | null {
  try {
    if (envelope.length > 1024) return null;
    const [version, ivEncoded, tagEncoded, ciphertextEncoded, extra] = envelope.split('.');
    if (version !== 'v1' || extra !== undefined || !ivEncoded || !tagEncoded || !ciphertextEncoded)
      return null;
    const fields = [ivEncoded, tagEncoded, ciphertextEncoded];
    if (
      fields.some(
        (field) =>
          !/^[A-Za-z0-9+/]+={0,2}$/.test(field) ||
          Buffer.from(field, 'base64').toString('base64') !== field,
      )
    )
      return null;
    const iv = Buffer.from(ivEncoded, 'base64');
    const tag = Buffer.from(tagEncoded, 'base64');
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv('aes-256-gcm', master, iv);
    decipher.setAAD(AAD);
    decipher.setAuthTag(tag);
    const credential = Buffer.concat([
      decipher.update(Buffer.from(ciphertextEncoded, 'base64')),
      decipher.final(),
    ]).toString('utf8');
    return /^[\x21-\x7e]{20,512}$/.test(credential) ? credential : null;
  } catch {
    return null;
  } // Authentication failures return only a safe availability result.
}
