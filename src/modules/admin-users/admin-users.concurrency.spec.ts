import { AdminUsersService } from './admin-users.service';
import { BadRequestException } from '@nestjs/common';
const actor = { id: 'actor', email: 'actor@test', role: 'admin' as const };
describe('team mutation transactions', () => {
  function setup() {
    const current = { id: 'target', role: 'editor', isActive: false, authVersion: 4, version: 7 };
    const em = {
      query: jest.fn(),
      findOne: jest.fn(async (_entity: unknown, options: { where: { id: string } }) =>
        options.where.id === 'actor' ? { id: 'actor', isActive: true, role: 'admin' } : current,
      ),
      count: jest.fn(async () => 1),
      update: jest.fn(async (..._args: unknown[]) => ({ affected: 1 })),
    };
    const users = {
      findOne: jest.fn(async () => ({ ...current, isActive: true })),
      save: jest.fn(async (x) => x),
      manager: { transaction: jest.fn(async (fn) => fn(em)) },
    };
    const audit = { record: jest.fn() };
    const tokens = {
      revokeAllForUser: jest.fn(async () => {
        throw new Error('Redis offline');
      }),
    };
    return {
      service: new AdminUsersService(users as never, audit as never, tokens as never),
      current,
      em,
      users,
      audit,
    };
  }
  it('patches only supplied fields after reading the locked state and audits without Redis', async () => {
    const { service, users, em, audit } = setup();
    await expect(service.update('target', { role: 'editor' }, actor)).resolves.toMatchObject({
      isActive: false,
    });
    expect(users.save).not.toHaveBeenCalled();
    expect(em.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'target', version: 7 }),
      expect.objectContaining({ role: 'editor', authVersion: expect.any(Function) }),
    );
    expect(em.update.mock.calls[0][2]).not.toHaveProperty('isActive');
    expect(audit.record).toHaveBeenCalledWith(expect.anything(), em);
  });
  it('checks the remaining admin count within the same serialization boundary as mutation', async () => {
    const { service, em, current } = setup();
    Object.assign(current, { role: 'admin', isActive: true });
    em.count.mockResolvedValue(0);
    await expect(service.update('target', { isActive: false }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(em.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock($1, $2)', [1718986095, 1]);
    expect(em.update).not.toHaveBeenCalled();
  });
});
