import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthTokenService } from './auth-token.service';

class RedisStub {
  store = new Map<string, string>();
  sets = new Map<string, Set<string>>();
  client = {
    set: jest.fn(async (key: string, value: string) => {
      this.store.set(key, value);
      return 'OK';
    }),
    setex: jest.fn(async (key: string, _ttl: number, value: string) => {
      this.store.set(key, value);
      return 'OK';
    }),
    get: jest.fn(async (key: string) => this.store.get(key) ?? null),
    del: jest.fn(async (...keys: string[]) => {
      for (const k of keys) this.store.delete(k);
      return keys.length;
    }),
    multi: jest.fn(() => ({
      set: function (key: string, value: string) {
        store.set(key, value);
        return this;
      },
      setex: function (key: string, _ttl: number, value: string) {
        store.set(key, value);
        return this;
      },
      del: function (key: string) {
        store.delete(key);
        return this;
      },
      sadd: (key: string, value: string) => {
        const set = this.sets.get(key) ?? new Set<string>();
        set.add(value);
        this.sets.set(key, set);
        return this.client.multi();
      },
      expire: function () {
        return this;
      },
      exec: async () => [],
    })),
    eval: jest.fn(async (script: string, _keyCount: number, ...args: Array<string | number>) => {
      if (script.includes("local old = redis.call('GET'")) {
        const [oldKey, familyKey, denyKey, nextKey, oldHash, , nextRecord, nextHash] =
          args.map(String);
        if (!this.store.get(oldKey) || this.store.get(familyKey) !== oldHash) return 0;
        this.store.delete(oldKey);
        this.store.set(denyKey, '1');
        this.store.set(nextKey, nextRecord);
        this.store.set(familyKey, nextHash);
        return 1;
      }
      const [familyKey, refreshPrefix] = args.map(String);
      const current = this.store.get(familyKey);
      if (current) this.store.delete(refreshPrefix + current);
      this.store.delete(familyKey);
      return 1;
    }),
    sadd: jest.fn(async (key: string, value: string) => {
      const set = this.sets.get(key) ?? new Set<string>();
      set.add(value);
      this.sets.set(key, set);
      return 1;
    }),
    expire: jest.fn(async () => 1),
    smembers: jest.fn(async (key: string) => Array.from(this.sets.get(key) ?? [])),
    scanStream: jest.fn(() => {
      const keys = Array.from(this.store.keys()).filter((key) => key.startsWith('auth:refresh:'));
      return {
        async *[Symbol.asyncIterator]() {
          yield keys;
        },
      };
    }),
    mget: jest.fn(async (...keys: string[]) => keys.map((key) => this.store.get(key) ?? null)),
  };
}

let store: Map<string, string>;
const config = {
  JWT_ACCESS_SECRET: 'access-secret',
  JWT_ACCESS_TTL: 900,
  JWT_REFRESH_SECRET: 'refresh-secret',
  JWT_REFRESH_TTL: 86400,
};

describe('AuthTokenService — stateful refresh rotation', () => {
  let svc: AuthTokenService;
  let redis: RedisStub;

  beforeEach(() => {
    redis = new RedisStub();
    store = redis.store;
    svc = new AuthTokenService(new JwtService({}), redis as never, config as never);
  });

  it('issues access + refresh, stores hashed refresh in Redis', async () => {
    const pair = await svc.issuePair({
      id: 'user-1',
      email: 'a@b.test',
      role: 'admin',
    });
    expect(pair.accessToken).toMatch(/^eyJ/);
    expect(pair.refreshToken.split('.').length).toBe(2);
    expect(store.size).toBeGreaterThan(0);
  });

  it('rotation invalidates the old refresh and issues a new one', async () => {
    const first = await svc.issuePair({
      id: 'user-1',
      email: 'a@b.test',
      role: 'admin',
    });
    const second = await svc.rotate(first.refreshToken);
    expect(second.refreshToken).not.toEqual(first.refreshToken);
    await expect(svc.rotate(first.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(svc.rotate(second.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('keeps the original family expiry when rotating', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const first = await svc.issuePair({
      id: 'user-1',
      email: 'a@b.test',
      role: 'admin',
    });
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000 + 40_000_000);
    const second = await svc.rotate(first.refreshToken);
    expect(second.refreshExpiresIn).toBeLessThan(first.refreshExpiresIn);
    jest.restoreAllMocks();
  });
});
