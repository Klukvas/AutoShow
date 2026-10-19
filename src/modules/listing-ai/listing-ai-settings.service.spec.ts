import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ListingAiSettingsService } from './listing-ai-settings.service';

const admin = { id: 'admin', email: 'a@x', role: 'admin' as const };

function setup({ role = 'admin', usable = true } = {}) {
  let row = {
    id: 1,
    enabled: false,
    revision: 0,
    accessMode: 'all',
    selectedEditorIds: [] as string[],
  };
  const em = {
    findOne: jest.fn(async () => ({ ...row })),
    update: jest.fn(async (_e: unknown, _c: unknown, patch: object) => {
      row = { ...row, ...patch };
      return { affected: 1 };
    }),
  };
  const settings = {
    manager: { ...em, transaction: jest.fn(async (fn: (m: typeof em) => unknown) => fn(em)) },
  };
  const users = {
    findOne: jest.fn().mockResolvedValue({ id: 'admin', role }),
    count: jest.fn().mockResolvedValue(1),
  };
  const credentials = {
    state: jest.fn().mockResolvedValue({ usable, mode: 'own_key' }),
    mode: 'own_key',
  };
  const audit = { record: jest.fn() };
  const service = new ListingAiSettingsService(
    settings as never,
    users as never,
    credentials as never,
    audit as never,
  );
  return { service, row: () => row, audit, users, credentials };
}

describe('ListingAiSettingsService', () => {
  it('lets an admin switch descriptions on with a usable key and audits it', async () => {
    const { service, row, audit } = setup();
    expect(
      await service.update({ expectedRevision: 0, enabled: true, accessMode: 'admins' }, admin),
    ).toMatchObject({
      enabled: true,
      accessMode: 'admins',
      revision: 1,
      keyUsable: true,
      available: true,
    });
    expect(row()).toMatchObject({ enabled: true, revision: 1 });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'listing_ai.settings.update' }),
      expect.anything(),
    );
  });

  it('refuses to switch on without a usable key, on a stale revision, and for non-admins', async () => {
    await expect(
      setup({ usable: false }).service.update({ expectedRevision: 0, enabled: true }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      setup().service.update({ expectedRevision: 5, accessMode: 'all' }, admin),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(setup({ role: 'editor' }).service.get(admin)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('validates selected editors against active staff', async () => {
    const { service, users } = setup();
    users.count.mockResolvedValue(0);
    await expect(
      service.update(
        {
          expectedRevision: 0,
          accessMode: 'selected',
          selectedEditorIds: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
        },
        admin,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('saves the brand voice, clears blank parts and reports it back', async () => {
    const { service, row } = setup();
    const view = await service.update(
      {
        expectedRevision: 0,
        brandTone: 'Дружньо, без пафосу',
        brandBannedWords: ['ідеальний'],
        brandExample: 'Приклад.',
      },
      admin,
    );
    expect(view.brandVoice).toEqual({
      tone: 'Дружньо, без пафосу',
      bannedWords: ['ідеальний'],
      example: 'Приклад.',
    });
    await service.update({ expectedRevision: 1, brandTone: '', brandExample: '' }, admin);
    expect(row()).toMatchObject({
      brandTone: null,
      brandExample: null,
      brandBannedWords: ['ідеальний'],
    });
  });

  it('reports where the key comes from, even when it cannot be read', async () => {
    const managed = setup();
    managed.credentials.state.mockResolvedValue({ usable: true, mode: 'managed' });
    expect(await managed.service.get(admin)).toMatchObject({ keyMode: 'managed', keyUsable: true });
    const broken = setup();
    broken.credentials.state.mockRejectedValue(new Error('db'));
    expect(await broken.service.get(admin)).toMatchObject({
      keyMode: 'own_key',
      keyUsable: false,
      available: false,
    });
  });

  it('switching off needs no key', async () => {
    await expect(
      setup({ usable: false }).service.update({ expectedRevision: 0, enabled: false }, admin),
    ).resolves.toMatchObject({
      enabled: false,
      available: false,
    });
  });
});
