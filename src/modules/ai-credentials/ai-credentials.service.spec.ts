import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { PhotoAiMode } from '../../config/env.validation';
import { decryptCredential, encryptCredential, encryptionKey } from './ai-credential.crypto';
import { AiCredentialsService, MANAGED_KEY_REJECTED } from './ai-credentials.service';

const MASTER = Buffer.alloc(32, 7).toString('base64');
const KEY = 'fixture-owner-secret-123456789';
const MANAGED_KEY = 'sk-managed-fixture-0123456789abcdef';

function setup(config: Record<string, unknown> = { PHOTO_AI_ENCRYPTION_KEY: MASTER }) {
  let row = { id: 1, encryptedKey: null as string | null, revision: 0 };
  const query = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne: jest.fn(async () => ({ ...row })),
  };
  const em = {
    createQueryBuilder: jest.fn(() => query),
    update: jest.fn(async (_entity: unknown, _criteria: unknown, patch: Partial<typeof row>) => {
      row = { ...row, ...patch };
      return { affected: 1 };
    }),
  };
  const service = new AiCredentialsService({ manager: em } as never, config as never);
  return { service, em, query, row: () => row };
}

describe('AI credential envelope', () => {
  it('encrypts with fresh IV and authenticated envelope; wrong master or tamper never returns plaintext', () => {
    const master = Buffer.alloc(32, 7);
    const first = encryptCredential(KEY, master);
    const second = encryptCredential(KEY, master);
    expect(first).not.toContain(KEY);
    expect(first).not.toBe(second);
    expect(decryptCredential(first, master)).toBe(KEY);
    expect(decryptCredential(first, Buffer.alloc(32, 8))).toBeNull();
    const parts = first.split('.');
    parts[2] = Buffer.alloc(16, 0).toString('base64');
    expect(decryptCredential(parts.join('.'), master)).toBeNull();
    expect(decryptCredential('v2.invalid', master)).toBeNull();
    expect(encryptionKey('invalid')).toBeNull();
    expect(encryptionKey(MASTER)).toEqual(master);
  });
});

describe('AiCredentialsService in own_key mode', () => {
  it('stores only ciphertext under a row lock and serves the key back', async () => {
    const { service, em, query, row } = setup();
    const { state, action } = await service.apply(em as never, { kind: 'replace', apiKey: KEY });
    expect(action).toBe('replaced');
    expect(state).toEqual({
      mode: 'own_key',
      configured: true,
      usable: true,
      setupAvailable: true,
    });
    expect(query.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(row().encryptedKey).not.toContain(KEY);
    expect(row().revision).toBe(1);
    expect(JSON.stringify(state)).not.toContain(row().encryptedKey);
    expect(await service.requireApiKey()).toBe(KEY);
  });

  it('keeps without writing and removes by clearing the ciphertext', async () => {
    const { service, em, row } = setup();
    await service.apply(em as never, { kind: 'replace', apiKey: KEY });
    em.update.mockClear();
    expect((await service.apply(em as never, { kind: 'keep' })).action).toBe('unchanged');
    expect(em.update).not.toHaveBeenCalled();
    const removed = await service.apply(em as never, { kind: 'remove' });
    expect(removed).toEqual({
      action: 'removed',
      state: { mode: 'own_key', configured: false, usable: false, setupAvailable: true },
    });
    expect(row()).toMatchObject({ encryptedKey: null, revision: 2 });
    await expect(service.requireApiKey()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('reports a tampered key as configured but unusable and never serves it', async () => {
    const { service, em } = setup();
    await em.update(null, null, { encryptedKey: 'v1.invalid' });
    expect(await service.state()).toMatchObject({ configured: true, usable: false });
    await expect(service.requireApiKey()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('refuses to store a key without a valid master key, before touching the row', async () => {
    const { service, em } = setup({ PHOTO_AI_ENCRYPTION_KEY: undefined });
    expect(() => service.assertChangeAllowed({ kind: 'replace', apiKey: KEY })).toThrow(
      ServiceUnavailableException,
    );
    await expect(
      service.apply(em as never, { kind: 'replace', apiKey: KEY }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(em.update).not.toHaveBeenCalled();
    expect(await service.state()).toMatchObject({ setupAvailable: false, usable: false });
  });

  it('hides storage errors behind a generic unavailable error', async () => {
    const { service, query } = setup();
    query.getOne.mockRejectedValue(new Error(`SQL failed: ${KEY}`));
    await expect(service.state()).rejects.toThrow('Налаштування ШІ поки недоступні.');
    await expect(service.requireApiKey()).rejects.not.toThrow(KEY);
  });
});

describe('AiCredentialsService in managed mode', () => {
  const managed = { PHOTO_AI_MODE: PhotoAiMode.Managed, PHOTO_AI_MANAGED_API_KEY: MANAGED_KEY };

  it('serves the env key without reading or storing anything', async () => {
    const { service, em } = setup(managed);
    expect(await service.state()).toEqual({
      mode: 'managed',
      configured: true,
      usable: true,
      setupAvailable: true,
    });
    expect(await service.requireApiKey()).toBe(MANAGED_KEY);
    expect((await service.apply(em as never, { kind: 'keep' })).action).toBe('unchanged');
    expect(em.createQueryBuilder).not.toHaveBeenCalled();
    expect(em.update).not.toHaveBeenCalled();
  });

  it.each([{ kind: 'replace' as const, apiKey: KEY }, { kind: 'remove' as const }])(
    'rejects an own-key change (%o)',
    async (change) => {
      const { service, em } = setup(managed);
      expect(() => service.assertChangeAllowed(change)).toThrow(
        new BadRequestException(MANAGED_KEY_REJECTED),
      );
      await expect(service.apply(em as never, change)).rejects.toBeInstanceOf(BadRequestException);
      expect(em.update).not.toHaveBeenCalled();
    },
  );
});
