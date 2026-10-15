import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import type { RefreshTokenRecord, TokenPair } from './auth-token.service';

export const RECOVERY_SECONDS = 5;
export const RECOVERY_PREFIX = 'auth:refresh-recovery:';
export interface RefreshRecovery {
  proofHash: string;
  successorHash: string;
  record: RefreshTokenRecord;
  encrypted: string;
}

function recoveryKey(secret: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secret, '', 'autoflow:refresh-recovery:v1', 32));
}
export function encryptRecovery(pair: TokenPair, secret: string, binding: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', recoveryKey(secret), iv);
  cipher.setAAD(Buffer.from(binding));
  const now = Math.floor(Date.now() / 1000);
  const encrypted = Buffer.concat([
    cipher.update(
      JSON.stringify({
        pair,
        accessExpiresAt: now + pair.accessExpiresIn,
        refreshExpiresAt: now + pair.refreshExpiresIn,
      }),
    ),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
export function decryptRecovery(value: string, secret: string, binding: string): TokenPair {
  const bytes = Buffer.from(value, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', recoveryKey(secret), bytes.subarray(0, 12));
  decipher.setAAD(Buffer.from(binding));
  decipher.setAuthTag(bytes.subarray(12, 28));
  const decoded = JSON.parse(
    Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString(),
  ) as {
    pair: TokenPair;
    accessExpiresAt: number;
    refreshExpiresAt: number;
  };
  const now = Math.floor(Date.now() / 1000);
  const accessExpiresIn = decoded.accessExpiresAt - now;
  const refreshExpiresIn = decoded.refreshExpiresAt - now;
  if (accessExpiresIn <= 0 || refreshExpiresIn <= 0) throw new Error('Recovery expired');
  return { ...decoded.pair, accessExpiresIn, refreshExpiresIn };
}
