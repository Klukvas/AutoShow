import { HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { AllowWhenBillingBlocked } from '../../common/decorators/allow-when-billing-blocked.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { BillingGuard } from './billing.guard';

class Routes {
  @Public() publicRoute() {}
  @AllowWhenBillingBlocked() billingRoute() {}
  listings() {}
}

function contextFor(handler: keyof Routes, role: 'admin' | 'editor' = 'admin'): ExecutionContext {
  return {
    getHandler: () => Routes.prototype[handler],
    getClass: () => Routes,
    switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u', email: 'e', role } }) }),
  } as unknown as ExecutionContext;
}

function makeGuard({ isEnabled = true, isBlocked = true } = {}) {
  const billing = { isEnabled, isBlocked: jest.fn().mockResolvedValue(isBlocked) };
  return { guard: new BillingGuard(new Reflector(), billing as never), billing };
}

async function rejection(promise: Promise<unknown>): Promise<HttpException> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  if (!(err instanceof HttpException)) throw new Error('expected an HttpException');
  return err;
}

describe('BillingGuard', () => {
  it('never blocks public routes (storefront keeps working)', async () => {
    const { guard, billing } = makeGuard();
    await expect(guard.canActivate(contextFor('publicRoute'))).resolves.toBe(true);
    expect(billing.isBlocked).not.toHaveBeenCalled();
  });

  it('lets @AllowWhenBillingBlocked routes through while blocked', async () => {
    const { guard } = makeGuard();
    await expect(guard.canActivate(contextFor('billingRoute'))).resolves.toBe(true);
  });

  it.each(['admin', 'editor'] as const)(
    'rejects other authenticated routes for a blocked %s with 402 BillingBlocked',
    async (role) => {
      const { guard } = makeGuard();
      const err = await rejection(guard.canActivate(contextFor('listings', role)));
      expect(err.getStatus()).toBe(402);
      expect(err.getResponse()).toMatchObject({
        statusCode: 402,
        error: 'BillingBlocked',
        message: expect.stringContaining('не оплачено'),
      });
    },
  );

  it('allows everything when the subscription is not blocked', async () => {
    const { guard } = makeGuard({ isBlocked: false });
    await expect(guard.canActivate(contextFor('listings', 'editor'))).resolves.toBe(true);
  });

  it('is a no-op when billing is disabled', async () => {
    const { guard, billing } = makeGuard({ isEnabled: false });
    await expect(guard.canActivate(contextFor('listings'))).resolves.toBe(true);
    expect(billing.isBlocked).not.toHaveBeenCalled();
  });
});
