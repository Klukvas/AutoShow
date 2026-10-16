import { ConflictException, HttpException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import * as photoStore from '../photo-ai/photo-credits.store';
import type { BillingSettings } from './billing.config';
import { BillingGuard } from './billing.guard';
import { PhotoPackController } from './photo-pack.controller';
import { lowThreshold, PhotoPackService } from './photo-pack.service';

jest.mock('../photo-ai/photo-credits.store', () => ({
  ...jest.requireActual('../photo-ai/photo-credits.store'),
  ensureBalance: jest.fn().mockResolvedValue(undefined),
  needsBalanceSetup: jest.fn().mockResolvedValue(true),
  readBalance: jest.fn(),
}));
const store = photoStore as jest.Mocked<typeof photoStore>;

const admin = { id: 'a', email: 'a@x', role: 'admin' as const };
const packs = {
  isEnabled: true,
  size: 50,
  priceUah: 300,
  freePhotos: 3,
  redirectUrl: 'https://site.example/admin/branding?photoPackReturned=1',
};

function setup(photoPacks: BillingSettings['photoPacks'] = packs) {
  const em = {};
  const repo = { manager: { transaction: jest.fn(async (fn: (m: unknown) => unknown) => fn(em)) } };
  const billing = {
    listInvoices: jest.fn().mockResolvedValue([]),
    createMonobankInvoice: jest.fn().mockResolvedValue({ invoiceId: 'p2', pageUrl: 'https://x' }),
    syncInvoice: jest.fn(),
  };
  const service = new PhotoPackService(
    { photoPacks } as BillingSettings,
    repo as never,
    billing as never,
  );
  return { service, billing, em };
}

const balance = (available: number) => ({
  credited: available,
  reserved: 0,
  consumed: 0,
  available,
});

beforeEach(() => jest.clearAllMocks());

describe('PhotoPackService.overview', () => {
  it('reports own_key mode without any balance or price', async () => {
    const { service } = setup({ ...packs, isEnabled: false });
    await expect(service.overview()).resolves.toEqual({ mode: 'own_key' });
    expect(store.readBalance).not.toHaveBeenCalled();
  });

  it('grants free photos, then returns balance, terms and pack history', async () => {
    const { service, billing, em } = setup();
    store.readBalance.mockResolvedValue(balance(40));
    await expect(service.overview()).resolves.toMatchObject({
      mode: 'managed',
      packSize: 50,
      packPriceUah: 300,
      balance: { available: 40 },
      isLow: false,
      isEmpty: false,
    });
    expect(store.ensureBalance).toHaveBeenCalledWith(em, 3);
    expect(billing.listInvoices).toHaveBeenCalledWith('photo_pack');
  });

  it.each([
    [5, true, false],
    [6, false, false],
    [0, false, true],
    [-3, false, true],
  ])('available %i → low %s, empty %s (pack of 50)', async (available, isLow, isEmpty) => {
    const { service } = setup();
    store.readBalance.mockResolvedValue(balance(available));
    await expect(service.overview()).resolves.toMatchObject({ isLow, isEmpty });
  });

  it('uses 10% of the pack as the low mark for big packs, at least 5', () => {
    expect(lowThreshold(20)).toBe(5);
    expect(lowThreshold(100)).toBe(10);
    expect(lowThreshold(250)).toBe(25);
  });
});

describe('PhotoPackService purchase', () => {
  it('buys exactly one pack at the env price with the photo-AI return page', async () => {
    const { service, billing } = setup();
    await service.buyPack(admin);
    expect(billing.createMonobankInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'photo_pack',
        amountKop: 30_000,
        photos: 50,
        periodMonths: null,
        redirectUrl: packs.redirectUrl,
      }),
      admin,
    );
  });

  it('refuses purchases and syncs in own_key mode', async () => {
    const { service, billing } = setup({ ...packs, isEnabled: false });
    await expect(service.buyPack(admin)).rejects.toBeInstanceOf(ConflictException);
    expect(() => service.sync('p2', admin)).toThrow(ConflictException);
    expect(billing.createMonobankInvoice).not.toHaveBeenCalled();
  });

  it('syncs only photo-pack invoices', async () => {
    const { service, billing } = setup();
    await service.sync('p2', admin);
    expect(billing.syncInvoice).toHaveBeenCalledWith('p2', admin, 'photo_pack');
  });
});

describe('PhotoPackController access', () => {
  it('is admin-only (editors never see price or balance)', () => {
    expect(new Reflector().get(ROLES_KEY, PhotoPackController)).toEqual(['admin']);
  });

  it.each(['overview', 'buy', 'sync'] as const)(
    'is blocked (402) while hosting is unpaid: %s',
    async (handler) => {
      const guard = new BillingGuard(new Reflector(), {
        isEnabled: true,
        isBlocked: jest.fn().mockResolvedValue(true),
      } as never);
      const context = {
        getHandler: () => PhotoPackController.prototype[handler],
        getClass: () => PhotoPackController,
      } as unknown as ExecutionContext;
      const err = await guard.canActivate(context).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(402);
    },
  );
});
