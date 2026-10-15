import { fork } from 'node:child_process';
import path from 'node:path';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { AuthTokenService, type RefreshTokenRecord, type TokenPair } from './auth-token.service';
const integration = process.env.AUDIT_TEST_REDIS_PORT ? describe : describe.skip;
integration('actual Redis rotation/recovery Lua', () => {
  let redis: Redis;
  let first: AuthTokenService;
  let second: AuthTokenService;
  const config = {
    JWT_ACCESS_SECRET: 'fixture-access',
    JWT_REFRESH_SECRET: 'fixture-refresh',
    JWT_ACCESS_TTL: 900,
    JWT_REFRESH_TTL: 600,
  };
  const user = {
    id: 'fixture-user',
    email: 'fixture@test',
    role: 'admin' as const,
    authVersion: 1,
  };
  const proof = 'a'.repeat(64);
  const validate = async (record: RefreshTokenRecord) => {
    if (record.authVersion !== user.authVersion) throw new Error('revoked');
    return { ...user };
  };
  beforeAll(() => {
    redis = new Redis({ host: '127.0.0.1', port: Number(process.env.AUDIT_TEST_REDIS_PORT) });
    first = new AuthTokenService(new JwtService(), { client: redis } as never, config as never);
    second = new AuthTokenService(new JwtService(), { client: redis } as never, config as never);
  });
  afterAll(async () => {
    await redis.quit();
  });
  beforeEach(() => {
    user.authVersion = 1;
  });
  it('two OS processes racing the same cookie get exactly one encrypted successor', async () => {
    const issued = await first.issuePair(user);
    const children = [0, 1].map(() =>
      fork(path.join(__dirname, 'refresh-race.fixture.cjs'), [], {
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      }),
    );
    await Promise.all(
      children.map(
        (child) => new Promise<void>((resolve) => child.once('message', () => resolve())),
      ),
    );
    const results = children.map(
      (child) =>
        new Promise<TokenPair>((resolve, reject) => {
          child.once('message', (message: { pair?: TokenPair; error?: string }) =>
            message.pair ? resolve(message.pair) : reject(new Error(message.error)),
          );
          child.send({ token: issued.refreshToken, proof });
        }),
    );
    const [a, b] = await Promise.all(results);
    expect(a.refreshToken).toBe(b.refreshToken);
    expect(a.accessToken).toBe(b.accessToken);
    const keys = await redis.keys('auth:refresh-recovery:*');
    const cached = await redis.mget(...keys);
    expect(cached.join()).not.toContain(a.refreshToken);
    expect(cached.join()).not.toContain(a.accessToken);
    await first.rotate(a.refreshToken, validate);
  }, 20000);
  it.each([undefined, 'b'.repeat(64)])(
    'missing/wrong proof keeps replay revocation (%s)',
    async (badProof) => {
      const issued = await first.issuePair(user);
      const successor = await first.rotate(issued.refreshToken, validate, proof);
      await expect(second.rotate(issued.refreshToken, validate, badProof)).rejects.toThrow(
        'replayed',
      );
      await expect(first.rotate(successor.refreshToken, validate, proof)).rejects.toThrow();
    },
  );
  it('retry cannot resurrect a logged-out or advanced family', async () => {
    const issued = await first.issuePair(user);
    const successor = await first.rotate(issued.refreshToken, validate, proof);
    await first.revoke(successor.refreshToken);
    await expect(second.rotate(issued.refreshToken, validate, proof)).rejects.toThrow();
    const next = await first.issuePair(user);
    const rotated = await first.rotate(next.refreshToken, validate, proof);
    await first.rotate(rotated.refreshToken, validate, proof);
    await expect(second.rotate(next.refreshToken, validate, proof)).rejects.toThrow();
  });
  it('changed authVersion rejects even a matching proof and expired cache rejects replay', async () => {
    const issued = await first.issuePair(user);
    await first.rotate(issued.refreshToken, validate, proof);
    user.authVersion++;
    await expect(second.rotate(issued.refreshToken, validate, proof)).rejects.toThrow('revoked');
    user.authVersion = 1;
    const next = await first.issuePair(user);
    await first.rotate(next.refreshToken, validate, proof);
    const keys = await redis.keys('auth:refresh-recovery:*');
    await Promise.all(keys.map((key) => redis.pexpire(key, 1)));
    await new Promise((resolve) => setTimeout(resolve, 10));
    await expect(second.rotate(next.refreshToken, validate, proof)).rejects.toThrow();
  });
});
