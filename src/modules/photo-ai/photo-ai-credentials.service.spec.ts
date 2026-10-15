import {
  BadRequestException,
  ForbiddenException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PhotoAiCredentialsService } from './photo-ai-credentials.service';
import { decryptCredential, encryptCredential, encryptionKey } from './photo-ai-credential.crypto';
import { PhotoAiProvider } from './photo-ai.provider';
import sharp from 'sharp';

const MASTER = Buffer.alloc(32, 7).toString('base64');
const KEY = 'fixture-owner-secret-123456789';
const REPLACEMENT = 'fixture-replacement-987654321';
const actor = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'admin' as const,
  email: 'owner@example.test',
};
function setup(master: string | undefined = MASTER) {
  let row = {
    id: 1,
    enabled: false,
    encryptedKey: null as string | null,
    revision: 0,
    accessMode: 'all',
    selectedEditorIds: [] as string[],
  };
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
  const repo = {
    manager: { ...em, transaction: jest.fn(async (fn: (manager: typeof em) => unknown) => fn(em)) },
  };
  const audit = { record: jest.fn() };
  const config = {
    PHOTO_AI_ENCRYPTION_KEY: master as string | undefined,
    PHOTO_AI_MODEL: 'fixture-model',
    PHOTO_AI_TIMEOUT_SECONDS: 10,
  };
  const access = {
    requireAdmin: jest.fn().mockResolvedValue(undefined),
    validateSelected: jest.fn().mockResolvedValue(undefined),
    requireAllowed: jest.fn().mockResolvedValue(undefined),
  };
  const service = new PhotoAiCredentialsService(
    repo as never,
    config as never,
    audit as never,
    access as never,
  );
  return {
    service,
    access,
    row: () => row,
    setRow: (patch: Partial<typeof row>) => {
      row = { ...row, ...patch };
    },
    query,
    em,
    audit,
    config,
  };
}
describe('Owner photo AI credentials', () => {
  afterEach(() => jest.restoreAllMocks());
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
  it('saves only ciphertext and returns handcrafted safe metadata/audit', async () => {
    const { service, row, audit } = setup();
    const response = await service.update(
      { expectedRevision: 0, apiKey: KEY, enabled: true },
      actor,
    );
    expect(response).toEqual({
      accessMode: 'all',
      selectedEditorIds: [],
      configured: true,
      enabled: true,
      available: true,
      setupAvailable: true,
      revision: 1,
      status: 'ready',
    });
    expect(row().encryptedKey).not.toContain(KEY);
    expect(JSON.stringify(response)).not.toContain(KEY);
    expect(JSON.stringify(response)).not.toContain(row().encryptedKey);
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain(KEY);
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain(row().encryptedKey);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: {
          enabled: true,
          accessMode: 'all',
          selectedEditorIds: [],
          credentialAction: 'replaced',
        },
      }),
      expect.anything(),
    );
    expect(audit.record.mock.calls[0][0]).not.toHaveProperty('entityId');
  });
  it('blank preserves, replacement changes, disable blocks and explicit removal clears+disables', async () => {
    const { service, row } = setup();
    await service.update({ expectedRevision: 0, apiKey: KEY, enabled: true }, actor);
    const encrypted = row().encryptedKey;
    await service.update({ expectedRevision: 1, apiKey: '   ' }, actor);
    expect(row().encryptedKey).toBe(encrypted);
    expect(await service.requireCredential()).toBe(KEY);
    await service.update({ expectedRevision: 2, apiKey: REPLACEMENT }, actor);
    expect(row().encryptedKey).not.toBe(encrypted);
    expect(await service.requireCredential()).toBe(REPLACEMENT);
    await service.update({ expectedRevision: 3, enabled: false }, actor);
    await expect(service.requireCredential()).rejects.toBeInstanceOf(ServiceUnavailableException);
    await service.update({ expectedRevision: 4, removeKey: true, enabled: true }, actor);
    expect(row()).toMatchObject({ enabled: false, encryptedKey: null });
  });
  it('guards expected revision and missing/tampered setup without leaking errors', async () => {
    const { service, em, setRow } = setup();
    await expect(
      service.update({ expectedRevision: 1, apiKey: KEY }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(em.update).not.toHaveBeenCalled();
    await expect(
      service.update({ expectedRevision: 0, enabled: true }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    setRow({ enabled: true, encryptedKey: 'v1.invalid' });
    expect((await service.metadata()).available).toBe(false);
    await expect(service.requireCredential()).rejects.toBeInstanceOf(ServiceUnavailableException);
    const missing = setup(undefined);
    missing.config.PHOTO_AI_ENCRYPTION_KEY = undefined;
    await expect(
      missing.service.update({ expectedRevision: 0, apiKey: KEY }, actor),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      missing.service.update({ expectedRevision: 0, enabled: false }, actor),
    ).resolves.toMatchObject({ available: false });
  });
  it('sanitizes DB parameter errors before reaching generic log/HTTP boundaries', async () => {
    const { service, em } = setup();
    em.update.mockRejectedValue(new Error(`SQL failed: ${KEY}`));
    await expect(service.update({ expectedRevision: 0, apiKey: KEY }, actor)).rejects.toThrow(
      'Налаштування ШІ поки недоступні.',
    );
    await expect(service.update({ expectedRevision: 0, apiKey: KEY }, actor)).rejects.not.toThrow(
      KEY,
    );
  });
  it('immediately uses new saved credentials in the same provider instance; disabled has no env fallback', async () => {
    const { service, config } = setup();
    const provider = new PhotoAiProvider(
      { ...config, OPENAI_API_KEY: 'must-never-be-used', PHOTO_AI_ENABLED: true } as never,
      service,
      { requireAllowed: jest.fn().mockResolvedValue(undefined) } as never,
    );
    const image = await sharp({
      create: { width: 20, height: 10, channels: 3, background: '#777' },
    })
      .png()
      .toBuffer();
    const network = jest
      .spyOn(global, 'fetch')
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ data: [{ b64_json: image.toString('base64') }] })),
      );
    await expect(provider.edit(image, 'prompt', actor.id)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(network).not.toHaveBeenCalled();
    await service.update({ expectedRevision: 0, apiKey: KEY, enabled: true }, actor);
    expect((await provider.availability()).enabled).toBe(true);
    await provider.edit(image, 'prompt', actor.id);
    expect(network.mock.calls[0][1]?.headers).toEqual({ Authorization: `Bearer ${KEY}` });
    await service.update({ expectedRevision: 1, apiKey: REPLACEMENT }, actor);
    await provider.edit(image, 'prompt', actor.id);
    expect(network.mock.calls[1][1]?.headers).toEqual({ Authorization: `Bearer ${REPLACEMENT}` });
    await service.update({ expectedRevision: 2, removeKey: true }, actor);
    expect((await provider.availability()).enabled).toBe(false);
    await expect(provider.edit(image, 'prompt', actor.id)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(network).toHaveBeenCalledTimes(2);
  });
});

describe('PhotoAiCredentials policy updates', () => {
  it('preserves encrypted credential for CAS policy-only saves and validates staff', async () => {
    const { service, row, access } = setup();
    await service.update({ expectedRevision: 0, apiKey: KEY, enabled: true }, actor);
    const encrypted = row().encryptedKey;
    const selectedEditorIds = ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
    expect(
      await service.update(
        { expectedRevision: 1, apiKey: '', accessMode: 'selected', selectedEditorIds },
        actor,
      ),
    ).toMatchObject({ accessMode: 'selected', selectedEditorIds, enabled: true, revision: 2 });
    expect(row().encryptedKey).toBe(encrypted);
    expect(access.validateSelected).toHaveBeenCalledWith(selectedEditorIds);
    await expect(
      service.update({ expectedRevision: 1, accessMode: 'admins' }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('rejects a stale admin identity before changing credentials or policy', async () => {
    const { service, access, em } = setup();
    access.requireAdmin.mockRejectedValue(new ForbiddenException());
    await expect(
      service.update({ expectedRevision: 0, accessMode: 'all', apiKey: KEY }, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.update).not.toHaveBeenCalled();
  });
});
