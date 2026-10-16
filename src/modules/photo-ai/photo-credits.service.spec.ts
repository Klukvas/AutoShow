import { HttpException } from '@nestjs/common';
import { PhotoAiMode } from '../../config/env.validation';
import { PhotoCreditsService } from './photo-credits.service';
import * as store from './photo-credits.store';

jest.mock('./photo-credits.store', () => ({
  ...jest.requireActual('./photo-credits.store'),
  ensureBalance: jest.fn().mockResolvedValue(undefined),
  needsBalanceSetup: jest.fn().mockResolvedValue(true),
  readBalance: jest.fn(),
  reservePhoto: jest.fn(),
  settlePhoto: jest.fn().mockResolvedValue(true),
  unsettledGenerations: jest.fn().mockResolvedValue([]),
}));
const mocked = store as jest.Mocked<typeof store>;

function setup(mode: PhotoAiMode, freePhotos = 0) {
  const em = { query: jest.fn() };
  const repo = {
    manager: { ...em, transaction: jest.fn(async (fn: (m: typeof em) => unknown) => fn(em)) },
  };
  const service = new PhotoCreditsService(
    repo as never,
    {
      PHOTO_AI_MODE: mode,
      PHOTO_AI_FREE_PHOTOS: freePhotos,
    } as never,
  );
  jest
    .spyOn((service as unknown as { logger: { warn: () => void } }).logger, 'warn')
    .mockImplementation(() => undefined);
  return { service, em, repo };
}

const admin = { id: 'a', role: 'admin' as const };
const editor = { id: 'e', role: 'editor' as const };

beforeEach(() => jest.clearAllMocks());

describe('PhotoCreditsService in own_key mode', () => {
  it('never reserves or limits anything', async () => {
    const { service, em } = setup(PhotoAiMode.OwnKey);
    await service.reserve(em as never, 'g1', admin);
    await expect(service.hasCredit()).resolves.toBe(true);
    expect(mocked.reservePhoto).not.toHaveBeenCalled();
    expect(mocked.readBalance).not.toHaveBeenCalled();
  });
});

describe('PhotoCreditsService in managed mode', () => {
  it('grants the configured free photos before reading or reserving', async () => {
    const { service, em } = setup(PhotoAiMode.Managed, 5);
    mocked.readBalance.mockResolvedValue({ credited: 5, reserved: 0, consumed: 0, available: 5 });
    await expect(service.hasCredit()).resolves.toBe(true);
    mocked.reservePhoto.mockResolvedValue(true);
    await service.reserve(em as never, 'g1', admin);
    expect(mocked.ensureBalance).toHaveBeenCalledWith(em, 5);
    expect(mocked.reservePhoto).toHaveBeenCalledWith(em, 'g1', 'a');
  });

  it.each([
    [admin, 'Фото закінчилися — докупіть пакет.'],
    [editor, 'Обробка ШІ недоступна.'],
  ])('rejects with 402 when no photos are left (%o)', async (actor, message) => {
    const { service, em } = setup(PhotoAiMode.Managed);
    mocked.reservePhoto.mockResolvedValue(false);
    const err = await service.reserve(em as never, 'g1', actor).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(402);
    expect((err as HttpException).getResponse()).toMatchObject({
      error: 'PhotoCreditsExhausted',
      message,
    });
  });

  it('reads without writing once the row exists and the free grant is done', async () => {
    const { service, repo } = setup(PhotoAiMode.Managed, 5);
    mocked.needsBalanceSetup.mockResolvedValueOnce(false);
    mocked.readBalance.mockResolvedValue({ credited: 5, reserved: 0, consumed: 0, available: 5 });
    await expect(service.balance()).resolves.toMatchObject({ available: 5 });
    expect(mocked.ensureBalance).not.toHaveBeenCalled();
    expect(repo.manager.transaction).not.toHaveBeenCalled();
  });

  it('reports no credit at zero or below', async () => {
    const { service } = setup(PhotoAiMode.Managed);
    mocked.readBalance.mockResolvedValue({ credited: 3, reserved: 0, consumed: 5, available: -2 });
    await expect(service.hasCredit()).resolves.toBe(false);
  });
});

describe('PhotoCreditsService.settle', () => {
  it.each([
    ['ready', 'consume'],
    ['failed', 'release'],
    ['interrupted', 'release'],
    [null, 'release'],
  ] as const)('settles a %s generation as %s', async (status, outcome) => {
    const { service, em } = setup(PhotoAiMode.Managed);
    await service.settle('g1', status);
    expect(mocked.settlePhoto).toHaveBeenCalledWith(em, 'g1', outcome);
  });

  it.each(['queued', 'processing'])(
    'leaves an in-flight (%s) generation reserved',
    async (status) => {
      const { service } = setup(PhotoAiMode.Managed);
      await expect(service.settle('g1', status)).resolves.toBe(false);
      expect(mocked.settlePhoto).not.toHaveBeenCalled();
    },
  );

  it('settles a reservation even after switching back to own_key', async () => {
    const { service, em } = setup(PhotoAiMode.OwnKey);
    await service.settle('g1', 'failed');
    expect(mocked.settlePhoto).toHaveBeenCalledWith(em, 'g1', 'release');
  });

  it('sweeps open reservations of finished generations', async () => {
    const { service, em } = setup(PhotoAiMode.Managed);
    mocked.unsettledGenerations.mockResolvedValue([
      { generationId: 'g1', outcome: 'consume' },
      { generationId: 'g2', outcome: 'release' },
    ]);
    await expect(service.sweep()).resolves.toBe(2);
    expect(mocked.settlePhoto).toHaveBeenCalledWith(em, 'g1', 'consume');
    expect(mocked.settlePhoto).toHaveBeenCalledWith(em, 'g2', 'release');
  });
});
