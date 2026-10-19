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
  const credentials = { state: jest.fn().mockResolvedValue({ usable }) };
  const audit = { record: jest.fn() };
  const service = new ListingAiSettingsService(
    settings as never,
    users as never,
    credentials as never,
    audit as never,
  );
  return { service, row: () => row, audit, users };
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

  it('switching off needs no key', async () => {
    await expect(
      setup({ usable: false }).service.update({ expectedRevision: 0, enabled: false }, admin),
    ).resolves.toMatchObject({
      enabled: false,
      available: false,
    });
  });
});
