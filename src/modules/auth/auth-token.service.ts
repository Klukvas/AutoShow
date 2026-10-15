import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import {
  RECOVERY_PREFIX,
  RECOVERY_SECONDS,
  encryptRecovery,
  decryptRecovery,
  type RefreshRecovery,
} from './refresh-recovery';
import { RedisService } from '../../common/redis/redis.service';
import type { AppConfig } from '../../config/config.module';
import type { AdminRole } from '../admin-users/entities/admin-user.entity';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: AdminRole;
  authVersion: number;
  /** Issued-at (seconds) — added automatically by jwt.sign; used to reject
   *  access tokens minted before a revocation cut-off. */
  iat?: number;
}

export interface RefreshTokenRecord {
  userId: string;
  role: AdminRole;
  authVersion: number;
  email: string;
  family: string;
  issuedAt: number;
  expiresAt: number;
}

const REFRESH_PREFIX = 'auth:refresh:';
const FAMILY_PREFIX = 'auth:refresh-family:';
const USER_FAMILIES_PREFIX = 'auth:user-families:';
const DENYLIST_PREFIX = 'auth:denylist:';
const MIN_IAT_PREFIX = 'auth:min-iat:';

interface BuiltTokenPair {
  pair: TokenPair;
  refreshHash: string;
  record: RefreshTokenRecord;
}

@Injectable()
export class AuthTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
  ) {}

  async issuePair(
    user: { id: string; email: string; role: AdminRole; authVersion: number },
    familyOverride?: string,
  ): Promise<TokenPair> {
    const family = familyOverride ?? randomBytes(16).toString('hex');
    const built = await this.buildPair(user, family);
    const userFamiliesKey = USER_FAMILIES_PREFIX + user.id;

    await this.redis.client
      .multi()
      .set(
        REFRESH_PREFIX + built.refreshHash,
        JSON.stringify(built.record),
        'EX',
        built.pair.refreshExpiresIn,
      )
      .set(FAMILY_PREFIX + family, built.refreshHash, 'EX', built.pair.refreshExpiresIn)
      .sadd(userFamiliesKey, family)
      .expire(userFamiliesKey, built.pair.refreshExpiresIn)
      .exec();

    return built.pair;
  }

  /**
   * Validate and rotate. The old refresh token is denylisted on success; any
   * future use of the same token (replay) is detected and the entire family
   * is revoked.
   */
  async rotate(
    refreshToken: string,
    validateUser?: (
      record: RefreshTokenRecord,
    ) => Promise<{ id: string; email: string; role: AdminRole; authVersion: number }>,
    retryProof?: string,
  ): Promise<TokenPair & { payload: RefreshTokenRecord }> {
    const refreshHash = this.hash(refreshToken);
    const family = refreshToken.split('.')[0];
    const recover = () => this.recoverRotation(refreshHash, retryProof, validateUser);
    const recordRaw = await this.redis.client.get(REFRESH_PREFIX + refreshHash);
    if (!recordRaw) {
      const recovered = await recover();
      if (recovered) return recovered;
      if (family) await this.revokeFamily(family);
      throw new UnauthorizedException('Refresh token invalid or replayed');
    }
    const record: RefreshTokenRecord = JSON.parse(recordRaw);
    if (record.family !== family) {
      await this.revokeFamily(record.family);
      throw new UnauthorizedException('Refresh token invalid');
    }

    const currentUser = validateUser
      ? await validateUser(record)
      : {
          id: record.userId,
          email: record.email,
          role: record.role,
          authVersion: record.authVersion,
        };
    const familyExpiresAt = record.expiresAt ?? record.issuedAt + this.config.JWT_REFRESH_TTL;
    const next = await this.buildPair(currentUser, record.family, familyExpiresAt);
    const proofHash = retryProof ? this.hash(retryProof) : '';
    const recovery: RefreshRecovery | null = retryProof
      ? {
          proofHash,
          successorHash: next.refreshHash,
          record,
          encrypted: encryptRecovery(
            next.pair,
            this.config.JWT_REFRESH_SECRET,
            `${refreshHash}:${proofHash}`,
          ),
        }
      : null;
    const result = (await this.redis.client.eval(
      `
        local old = redis.call('GET', KEYS[1])
        if not old then return 0 end
        local current = redis.call('GET', KEYS[2])
        if current ~= ARGV[1] then return 0 end
        redis.call('DEL', KEYS[1])
        redis.call('SETEX', KEYS[3], ARGV[2], '1')
        redis.call('SETEX', KEYS[4], ARGV[2], ARGV[3])
        redis.call('SETEX', KEYS[2], ARGV[2], ARGV[4])
        if ARGV[5] ~= '' then redis.call('SETEX', KEYS[5], ARGV[6], ARGV[5]) end
        return 1
      `,
      5,
      REFRESH_PREFIX + refreshHash,
      FAMILY_PREFIX + record.family,
      DENYLIST_PREFIX + refreshHash,
      REFRESH_PREFIX + next.refreshHash,
      RECOVERY_PREFIX + refreshHash,
      refreshHash,
      next.pair.refreshExpiresIn,
      JSON.stringify(next.record),
      next.refreshHash,
      recovery ? JSON.stringify(recovery) : '',
      RECOVERY_SECONDS,
    )) as number;
    if (Number(result) !== 1) {
      const recovered = await recover();
      if (recovered) return recovered;
      await this.revokeFamily(record.family);
      throw new UnauthorizedException('Refresh token invalid or replayed');
    }
    await this.redis.client
      .multi()
      .sadd(USER_FAMILIES_PREFIX + currentUser.id, record.family)
      .expire(USER_FAMILIES_PREFIX + currentUser.id, this.config.JWT_REFRESH_TTL)
      .exec();
    return { ...next.pair, payload: record };
  }

  private async recoverRotation(
    oldHash: string,
    retryProof: string | undefined,
    validateUser?: (
      record: RefreshTokenRecord,
    ) => Promise<{ id: string; email: string; role: AdminRole; authVersion: number }>,
  ): Promise<(TokenPair & { payload: RefreshTokenRecord }) | null> {
    if (!retryProof) return null;
    const raw = await this.redis.client.get(RECOVERY_PREFIX + oldHash);
    if (!raw) return null;
    const recovery = JSON.parse(raw) as RefreshRecovery;
    const proofHash = this.hash(retryProof);
    if (recovery.proofHash !== proofHash) return null;
    if (validateUser) await validateUser(recovery.record);
    // Recheck cache, proof and family atomically after the DB authorization read.
    const encrypted = await this.redis.client.eval(
      `
      local raw = redis.call('GET', KEYS[1])
      if not raw then return false end
      local value = cjson.decode(raw)
      if value.proofHash ~= ARGV[1] then return false end
      if redis.call('GET', KEYS[2]) ~= value.successorHash then return false end
      if not redis.call('GET', ARGV[2] .. value.successorHash) then return false end
      return value.encrypted
    `,
      2,
      RECOVERY_PREFIX + oldHash,
      FAMILY_PREFIX + recovery.record.family,
      proofHash,
      REFRESH_PREFIX,
    );
    if (typeof encrypted !== 'string') return null;
    try {
      return {
        ...decryptRecovery(encrypted, this.config.JWT_REFRESH_SECRET, `${oldHash}:${proofHash}`),
        payload: recovery.record,
      };
    } catch {
      throw new UnauthorizedException('Refresh token invalid');
    }
  }

  async revoke(refreshToken: string): Promise<void> {
    const refreshHash = this.hash(refreshToken);
    const family = refreshToken.split('.')[0];
    if (family) await this.revokeFamily(family);
    await this.redis.client.setex(DENYLIST_PREFIX + refreshHash, this.config.JWT_REFRESH_TTL, '1');
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const userFamiliesKey = USER_FAMILIES_PREFIX + userId;
    const allFamilies = new Set(await this.redis.client.smembers(userFamiliesKey));
    const pattern = `${REFRESH_PREFIX}*`;
    const stream = this.redis.client.scanStream({ match: pattern, count: 100 });
    for await (const keys of stream as AsyncIterable<string[]>) {
      if (!keys.length) continue;
      const values = await this.redis.client.mget(...keys);
      const families = keys.flatMap((_, idx) => {
        const val = values[idx];
        if (!val) return [];
        try {
          const record = JSON.parse(val) as RefreshTokenRecord;
          return record.userId === userId ? [record.family] : [];
        } catch {
          return [];
        }
      });
      for (const family of families) allFamilies.add(family);
    }
    for (const family of allFamilies) await this.revokeFamily(family);
    await this.redis.client.del(userFamiliesKey);

    // Refresh tokens are stateful and now revoked; access tokens are stateless
    // and remain valid until expiry unless we record a cut-off. Any access
    // token issued at or before `now` for this user is rejected by the guard.
    // TTL matches the access TTL so the key self-expires once no such token
    // could still be alive. Use seconds; +1 covers same-second issuance.
    const cutoff = Math.floor(Date.now() / 1000) + 1;
    await this.redis.client.set(
      MIN_IAT_PREFIX + userId,
      String(cutoff),
      'EX',
      this.config.JWT_ACCESS_TTL,
    );
  }

  verifyAccess(token: string): AccessTokenPayload {
    try {
      return this.jwt.verify<AccessTokenPayload>(token, {
        secret: this.config.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Access token invalid');
    }
  }

  /** True if the access token predates a revocation cut-off for its user. */
  async isAccessTokenRevoked(userId: string, iat: number | undefined): Promise<boolean> {
    const raw = await this.redis.client.get(MIN_IAT_PREFIX + userId);
    if (!raw) return false;
    if (iat === undefined) return true;
    return iat < Number(raw);
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async buildPair(
    user: { id: string; email: string; role: AdminRole; authVersion: number },
    family: string,
    familyExpiresAt?: number,
  ): Promise<BuiltTokenPair> {
    const now = Math.floor(Date.now() / 1000);
    const accessExpiresIn = this.config.JWT_ACCESS_TTL;
    const expiresAt = familyExpiresAt ?? now + this.config.JWT_REFRESH_TTL;
    const refreshExpiresIn = expiresAt - now;
    if (refreshExpiresIn <= 0) {
      await this.revokeFamily(family);
      throw new UnauthorizedException('Refresh token expired');
    }
    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        authVersion: user.authVersion,
      },
      {
        secret: this.config.JWT_ACCESS_SECRET,
        expiresIn: accessExpiresIn,
      },
    );
    const refreshToken = `${family}.${randomBytes(48).toString('base64url')}`;
    const refreshHash = this.hash(refreshToken);
    return {
      pair: { accessToken, refreshToken, accessExpiresIn, refreshExpiresIn },
      refreshHash,
      record: {
        userId: user.id,
        role: user.role,
        authVersion: user.authVersion,
        email: user.email,
        family,
        issuedAt: now,
        expiresAt,
      },
    };
  }

  private async revokeFamily(family: string): Promise<void> {
    await this.redis.client.eval(
      `
        local current = redis.call('GET', KEYS[1])
        if current then redis.call('DEL', ARGV[1] .. current) end
        redis.call('DEL', KEYS[1])
        return 1
      `,
      1,
      FAMILY_PREFIX + family,
      REFRESH_PREFIX,
    );
  }
}
