import { BadRequestException, ConflictException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AdminUsersService } from './admin-users.service';

const actor: AuthenticatedUser = { id: 'admin-1', email: 'admin@example.com', role: 'admin' };

describe('AdminUsersService team management', () => {
  const makeService = () => {
    const users = {
      findOne: jest.fn(),
      create: jest.fn((value) => ({ id: 'member-1', ...value })),
      save: jest.fn(async (value) => value),
      softRemove: jest.fn(),
      manager: { transaction: jest.fn() },
    };
    const em = {
      query: jest.fn(),
      findOne: jest.fn((_entity, opts) =>
        opts.where.id === actor.id ? { ...actor, isActive: true } : users.findOne(opts),
      ),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      getRepository: () => users,
    };
    users.manager.transaction.mockImplementation(async (fn) => fn(em));
    const audit = { record: jest.fn() };
    const tokens = { revokeAllForUser: jest.fn() };
    const service = new AdminUsersService(users as never, audit as never, tokens as never);
    return { service, users, audit, tokens, em };
  };

  it('creates a team member with the editor role by default', async () => {
    const { service, users } = makeService();
    users.findOne.mockResolvedValue(null);

    const member = await service.create(
      {
        email: 'Editor@Example.com',
        password: 'temporary-password',
      },
      actor,
    );

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'editor@example.com',
        role: 'editor',
        isActive: true,
      }),
    );
    expect(member).not.toHaveProperty('passwordHash');
  });

  it('rejects creating a user with an email that is already in use', async () => {
    const { service, users } = makeService();
    users.findOne.mockResolvedValue({ id: 'existing', email: 'editor@example.com' });

    await expect(
      service.create({ email: 'editor@example.com', password: 'temporary-password' }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('prevents an admin from disabling their own account', async () => {
    const { service, users } = makeService();
    users.findOne.mockResolvedValue({ id: 'admin-1', role: 'admin' });

    await expect(service.update('admin-1', { isActive: false }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(users.save).not.toHaveBeenCalled();
  });

  it('prevents an admin from changing their own role', async () => {
    const { service, users } = makeService();
    users.findOne.mockResolvedValue({ id: 'admin-1', role: 'admin' });

    await expect(service.update('admin-1', { role: 'editor' }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(users.save).not.toHaveBeenCalled();
  });

  it('increments DB auth version and audits after a password change', async () => {
    const { service, users, em, audit } = makeService();
    users.findOne.mockResolvedValue({ id: 'member-1', role: 'editor' });

    await service.update('member-1', { password: 'new-secret-password' }, actor);
    expect(em.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ authVersion: expect.any(Function) }),
    );
    expect(audit.record).toHaveBeenCalledWith(expect.anything(), em);
  });

  it('prevents an admin from deleting their own account', async () => {
    const { service, users } = makeService();
    users.findOne.mockResolvedValue({ id: 'admin-1', role: 'admin' });

    await expect(service.remove('admin-1', actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(users.softRemove).not.toHaveBeenCalled();
  });
});
