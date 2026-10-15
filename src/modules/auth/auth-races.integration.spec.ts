import { AdminAuthVersion1792000300000 } from '../../database/migrations/1792000300000-AdminAuthVersion';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import { AuthController } from './auth.controller';
import { AdminUsersController } from '../admin-users/admin-users.controller';
import { RolesGuard } from './roles.guard';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { AdminUser } from '../admin-users/entities/admin-user.entity';
import { AdminUsersService } from '../admin-users/admin-users.service';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { JwtAuthGuard } from './jwt.guard';

jest.mock('argon2', () => ({
  ...jest.requireActual('argon2'),
  verify: jest.fn(jest.requireActual('argon2').verify),
}));

const integration = process.env.AUDIT_TEST_PG_PORT ? describe : describe.skip;
integration('PostgreSQL auth races (isolated cluster only)', () => {
  let db: DataSource;
  let repo: Repository<AdminUser>;
  let audit: AuditLogService;
  let service: AdminUsersService;
  const tokens = {
    revokeAllForUser: jest.fn(async () => {
      throw new Error('Redis unavailable');
    }),
  };
  async function user(role: 'admin' | 'editor' = 'admin') {
    return repo.save(
      repo.create({
        email: `${randomUUID()}@test.local`,
        passwordHash: 'fixture-hash',
        role,
        isActive: true,
      }),
    );
  }
  beforeAll(async () => {
    db = await new DataSource({
      type: 'postgres',
      host: '127.0.0.1',
      port: Number(process.env.AUDIT_TEST_PG_PORT),
      username: 'audit_test',
      database: 'postgres',
      entities: [AdminUser, AuditLog],
      synchronize: true,
    }).initialize();
    repo = db.getRepository(AdminUser);
    audit = new AuditLogService(db.getRepository(AuditLog));
    service = new AdminUsersService(repo, audit, tokens as never);
  });
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
  });
  it('auth migration backfills existing accounts and reverses in an isolated transaction', async () => {
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query('CREATE SCHEMA audit_migration_fixture');
      await runner.query('SET LOCAL search_path TO audit_migration_fixture');
      await runner.query('CREATE TABLE admin_users (id integer PRIMARY KEY)');
      await runner.query('INSERT INTO admin_users(id) VALUES (1)');
      const migration = new AdminAuthVersion1792000300000();
      await migration.up(runner);
      expect(await runner.query('SELECT auth_version FROM admin_users')).toEqual([
        { auth_version: 1 },
      ]);
      await migration.down(runner);
      expect(
        await runner.query(
          "SELECT column_name FROM information_schema.columns WHERE table_schema = 'audit_migration_fixture' AND column_name = 'auth_version'",
        ),
      ).toEqual([]);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });
  it('two admins cannot concurrently demote each other to leave zero admins', async () => {
    await repo.createQueryBuilder().delete().execute();
    const [a, b] = await Promise.all([user(), user()]);
    const result = await Promise.allSettled([
      service.update(a.id, { role: 'editor' }, b),
      service.update(b.id, { role: 'editor' }, a),
    ]);
    expect(result.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(await repo.countBy({ role: 'admin', isActive: true })).toBe(1);
  });
  it('concurrent partial writes retain disable, role and password changes without Redis', async () => {
    const actor = await user();
    const target = await user();
    await Promise.all([
      service.update(target.id, { isActive: false }, actor),
      service.update(target.id, { role: 'editor' }, actor),
      service.update(target.id, { password: 'replacement-fixture-password' }, actor),
    ]);
    const current = await repo.findOneByOrFail({ id: target.id });
    expect(current).toMatchObject({ isActive: false, role: 'editor', authVersion: 4 });
    expect(
      await db
        .getRepository(AuditLog)
        .countBy({ entityId: target.id, action: 'admin_user.update' }),
    ).toBe(3);
  });
  it('an audit failure rolls back state and authVersion together', async () => {
    const actor = await user();
    const target = await user('editor');
    const failing = new AdminUsersService(
      repo,
      {
        record: async () => {
          throw new Error('audit down');
        },
      } as never,
      tokens as never,
    );
    await expect(failing.update(target.id, { isActive: false }, actor)).rejects.toThrow(
      'audit down',
    );
    expect(await repo.findOneByOrFail({ id: target.id })).toMatchObject({
      isActive: true,
      authVersion: 1,
    });
  });
  it('delete cannot be resurrected by a concurrent password update', async () => {
    const actor = await user();
    const target = await user('editor');
    await Promise.allSettled([
      service.remove(target.id, actor),
      service.update(target.id, { password: 'replacement-fixture-password' }, actor),
    ]);
    expect(await repo.findOneBy({ id: target.id })).toBeNull();
  });
  it('a login already hashing the old credential cannot cross a disable cutoff', async () => {
    const actor = await user();
    const target = await user('editor');
    const secret = await argon2.hash('old-fixture-password');
    await repo.update(target.id, { passwordHash: secret });
    let entered!: () => void;
    let release!: () => void;
    const enteredPromise = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const releasePromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = jest.requireActual<typeof argon2>('argon2').verify;
    const spy = jest.spyOn(argon2, 'verify').mockImplementation(async (...args) => {
      entered();
      await releasePromise;
      return original(...args);
    });
    const tokenService = { issuePair: jest.fn(async () => ({})) };
    const auth = new AuthService(
      repo,
      tokenService as never,
      { client: { incr: async () => 1, expire: async () => 1 } } as never,
      { AUTH_LOGIN_RATE_PER_MIN: 100 } as never,
    );
    const pending = auth.login({
      email: target.email,
      password: 'old-fixture-password',
      ip: 'fixture',
    });
    await enteredPromise;
    await service.update(target.id, { isActive: false }, actor);
    release();
    await expect(pending).rejects.toThrow('Invalid credentials');
    expect(tokenService.issuePair).not.toHaveBeenCalled();
    spy.mockRestore();
    jest.mocked(argon2.verify).mockImplementation(original);
  });
  it('guard rejects old versions even when Redis is unavailable and uses current DB role', async () => {
    const target = await user();
    const tokenService = new AuthTokenService(
      new JwtService(),
      {} as never,
      { JWT_ACCESS_SECRET: 'local-fixture-access' } as never,
    );
    const token = await new JwtService().signAsync(
      { sub: target.id, role: 'admin', email: 'stale@test', authVersion: 1 },
      { secret: 'local-fixture-access' },
    );
    const guard = new JwtAuthGuard(tokenService, new Reflector(), repo);
    const request = { headers: { authorization: `Bearer ${token}` } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => () => undefined,
      getClass: () => class {},
    } as unknown as ExecutionContext;
    await repo.update(target.id, { role: 'editor' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toMatchObject({ user: { role: 'editor', email: target.email } });
    await repo.increment({ id: target.id }, 'authVersion', 1);
    await expect(guard.canActivate(context)).rejects.toThrow('revoked');
  });
  it('real HTTP login, team disable, access and refresh enforce the DB cutoff', async () => {
    if (!process.env.AUDIT_TEST_REDIS_PORT) return;
    const redis = new Redis({ host: '127.0.0.1', port: Number(process.env.AUDIT_TEST_REDIS_PORT) });
    const config = {
      JWT_ACCESS_SECRET: 'http-fixture-access',
      JWT_REFRESH_SECRET: 'http-fixture-refresh',
      JWT_ACCESS_TTL: 900,
      JWT_REFRESH_TTL: 600,
      AUTH_LOGIN_RATE_PER_MIN: 100,
    };
    const tokenService = new AuthTokenService(
      new JwtService(),
      { client: redis } as never,
      config as never,
    );
    const auth = new AuthService(repo, tokenService, { client: redis } as never, config as never);
    const module = await Test.createTestingModule({
      controllers: [AuthController, AdminUsersController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: AdminUsersService, useValue: service },
        { provide: AuthTokenService, useValue: tokenService },
        { provide: getRepositoryToken(AdminUser), useValue: repo },
        JwtAuthGuard,
        RolesGuard,
      ],
    }).compile();
    const app = module.createNestApplication();
    app.useGlobalGuards(new JwtAuthGuard(tokenService, new Reflector(), repo));
    await app.listen(0, '127.0.0.1');
    try {
      const actor = await user();
      const target = await user('editor');
      await repo.update(target.id, { passwordHash: await argon2.hash('http-fixture-password') });
      const origin = await app.getUrl();
      const login = await fetch(`${origin}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: target.email, password: 'http-fixture-password' }),
      });
      expect(login.status).toBe(200);
      const pair = (await login.json()) as { accessToken: string; refreshToken: string };
      expect(
        (
          await fetch(`${origin}/auth/me`, {
            headers: { authorization: `Bearer ${pair.accessToken}` },
          })
        ).status,
      ).toBe(200);
      const actorPair = await tokenService.issuePair(actor);
      const disabled = await fetch(`${origin}/admin/users/${target.id}`, {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${actorPair.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ isActive: false }),
      });
      expect(disabled.status).toBe(200);
      expect(
        (
          await fetch(`${origin}/auth/me`, {
            headers: { authorization: `Bearer ${pair.accessToken}` },
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await fetch(`${origin}/auth/refresh`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ refreshToken: pair.refreshToken }),
          })
        ).status,
      ).toBe(401);
    } finally {
      await app.close();
      await redis.quit();
    }
  });
});
