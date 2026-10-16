import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import sharp from 'sharp';
import { PhotoAiMode } from '../../config/env.validation';
import { MANAGED_KEY_REJECTED, PhotoAiCredentialsService } from './photo-ai-credentials.service';
import { PhotoAiProvider } from './photo-ai.provider';

const MANAGED_KEY = 'sk-managed-fixture-0123456789abcdef';
const actor = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role: 'admin' as const, email: 'o@x' };

function setup() {
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
    manager: { ...em, transaction: jest.fn(async (fn: (m: typeof em) => unknown) => fn(em)) },
  };
  const config = {
    PHOTO_AI_MODE: PhotoAiMode.Managed,
    PHOTO_AI_MANAGED_API_KEY: MANAGED_KEY,
    PHOTO_AI_ENCRYPTION_KEY: undefined,
    PHOTO_AI_MODEL: 'fixture-model',
    PHOTO_AI_TIMEOUT_SECONDS: 10,
  };
  const access = {
    requireAdmin: jest.fn().mockResolvedValue(undefined),
    validateSelected: jest.fn().mockResolvedValue(undefined),
    requireAllowed: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { record: jest.fn() };
  const service = new PhotoAiCredentialsService(
    repo as never,
    config as never,
    audit as never,
    access as never,
  );
  const provider = new PhotoAiProvider(config as never, service, access as never);
  return { service, provider, row: () => row, audit };
}

describe('Photo AI credentials in managed mode', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reports managed metadata without needing a stored key or master key', async () => {
    const { service } = setup();
    const metadata = await service.metadata();
    expect(metadata).toMatchObject({
      mode: 'managed',
      configured: true,
      setupAvailable: true,
      enabled: false,
      status: 'disabled',
    });
    expect(JSON.stringify(metadata)).not.toContain(MANAGED_KEY);
  });

  it('lets the admin enable AI and change access without any key', async () => {
    const { service, row } = setup();
    const saved = await service.update(
      { expectedRevision: 0, enabled: true, accessMode: 'admins' },
      actor,
    );
    expect(saved).toMatchObject({ mode: 'managed', enabled: true, status: 'ready' });
    expect(row().encryptedKey).toBeNull();
  });

  it.each([{ apiKey: 'sk-owner-own-key-0123456789' }, { removeKey: true }])(
    'rejects setting or removing an own key (%o)',
    async (patch) => {
      const { service, row } = setup();
      await expect(service.update({ expectedRevision: 0, ...patch }, actor)).rejects.toThrow(
        new BadRequestException(MANAGED_KEY_REJECTED),
      );
      expect(row().revision).toBe(0);
    },
  );

  it('calls OpenAI with our env key once enabled, and never while disabled', async () => {
    const { service, provider } = setup();
    const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#777' } })
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

    await service.update({ expectedRevision: 0, enabled: true }, actor);
    await provider.edit(image, 'prompt', actor.id);
    expect(network.mock.calls[0][1]?.headers).toEqual({ Authorization: `Bearer ${MANAGED_KEY}` });
  });

  it('never writes the managed key to the audit log', async () => {
    const { service, audit } = setup();
    await service.update({ expectedRevision: 0, enabled: true }, actor);
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain(MANAGED_KEY);
  });
});
