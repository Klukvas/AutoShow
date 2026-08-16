import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ListingsService } from './listings.service';

/**
 * bulk() only orchestrates softDelete/adminFindById/transition, so we exercise
 * it on a prototype instance (no constructor deps) with those methods spied.
 */
function makeService(): ListingsService {
  return Object.create(ListingsService.prototype) as ListingsService;
}

const admin = { id: 'a1', role: 'admin', email: 'a@x' } as AuthenticatedUser;
const editor = { id: 'e1', role: 'editor', email: 'e@x' } as AuthenticatedUser;

describe('ListingsService.bulk', () => {
  it('rejects the delete action for a non-admin actor', async () => {
    const svc = makeService();
    await expect(svc.bulk(['id1'], 'delete', editor)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('isolates per-id failures — one bad id does not abort the batch', async () => {
    const svc = makeService();
    jest.spyOn(svc, 'adminFindById').mockImplementation(async (id: string) => {
      if (id === 'bad') throw new Error('boom');
      return { version: 2 } as never;
    });
    const transition = jest.spyOn(svc, 'transition').mockResolvedValue({} as never);

    const results = await svc.bulk(['ok', 'bad'], 'archive', admin);

    expect(results).toEqual([
      { id: 'ok', ok: true },
      { id: 'bad', ok: false, error: 'boom' },
    ]);
    // version is read per item and forwarded to the transition.
    expect(transition).toHaveBeenCalledWith('ok', 'archive', 2, admin);
  });

  it('dedupes ids and routes the delete action through softDelete (admin)', async () => {
    const svc = makeService();
    const softDelete = jest.spyOn(svc, 'softDelete').mockResolvedValue(undefined);

    const results = await svc.bulk(['x', 'x'], 'delete', admin);

    expect(softDelete).toHaveBeenCalledTimes(1);
    expect(results).toEqual([{ id: 'x', ok: true }]);
  });
});
