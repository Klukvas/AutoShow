import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';
import { RedisService } from '../../common/redis/redis.service';
import type { AppConfig } from '../../config/config.module';
import { AdminUser } from '../admin-users/entities/admin-user.entity';
import { AuthTokenService, type TokenPair } from './auth-token.service';

const LOGIN_RATE_PREFIX = 'auth:login-rate:';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  // A real argon2 hash of random bytes, verified for missing users so the
  // no-such-account path costs the same as a wrong-password path (defeats the
  // timing oracle — a syntactically invalid hash would fail in microseconds).
  private dummyHash = '';

  constructor(
    @InjectRepository(AdminUser)
    private readonly users: Repository<AdminUser>,
    private readonly tokens: AuthTokenService,
    private readonly redis: RedisService,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await argon2.hash(randomBytes(32).toString('hex'), {
      type: argon2.argon2id,
    });
  }

  async login(opts: {
    email: string;
    password: string;
    ip: string;
  }): Promise<TokenPair & { user: AdminUser }> {
    await this.checkLoginRate(opts.ip, opts.email);

    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: opts.email })
      .andWhere('user.deleted_at IS NULL')
      .getOne();

    // Always run argon2 against a real hash to keep the timing constant.
    const ok = await argon2
      .verify(user?.passwordHash ?? this.dummyHash, opts.password)
      .catch(() => false);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      // Same status/message as a bad password so the lock isn't an oracle.
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!ok) {
      await this.registerFailedAttempt(user.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.users.update(
      { id: user.id },
      { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    );

    const pair = await this.tokens.issuePair({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    return { ...pair, user };
  }

  /**
   * Increment the failed-attempt counter atomically (RETURNING the new value)
   * so concurrent attempts can't lose increments, then apply the lock exactly
   * when the threshold is crossed.
   */
  private async registerFailedAttempt(userId: string): Promise<void> {
    const res = await this.users
      .createQueryBuilder()
      .update(AdminUser)
      .set({ failedLoginAttempts: () => 'failed_login_attempts + 1' })
      .where('id = :id', { id: userId })
      .returning(['failedLoginAttempts'])
      .execute();
    const attempts = Number(
      (res.raw as Array<{ failed_login_attempts: number }>)[0]?.failed_login_attempts ?? 0,
    );
    if (attempts >= this.config.AUTH_MAX_FAILED_ATTEMPTS) {
      await this.users.update(
        { id: userId },
        {
          lockedUntil: new Date(Date.now() + this.config.AUTH_LOCKOUT_SECONDS * 1000),
          failedLoginAttempts: 0,
        },
      );
    }
  }

  async refresh(token: string): Promise<TokenPair> {
    const result = await this.tokens.rotate(token, async (record) => {
      const user = await this.users.findOne({
        where: { id: record.userId, deletedAt: IsNull() },
      });
      if (!user || !user.isActive) {
        await this.tokens.revokeAllForUser(record.userId);
        throw new UnauthorizedException('Refresh token user is no longer active');
      }
      return {
        id: user.id,
        email: user.email,
        role: user.role,
      };
    });
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      accessExpiresIn: result.accessExpiresIn,
      refreshExpiresIn: result.refreshExpiresIn,
    };
  }

  async logout(token: string): Promise<void> {
    await this.tokens.revoke(token);
  }

  /**
   * Two independent per-minute buckets: by IP (blocks a single host spraying
   * many accounts) and by email (blocks a distributed brute-force of one
   * account). Either tripping rejects the attempt.
   */
  private async checkLoginRate(ip: string, email: string): Promise<void> {
    const buckets = [
      `${LOGIN_RATE_PREFIX}ip:${ip}`,
      `${LOGIN_RATE_PREFIX}email:${email.toLowerCase()}`,
    ];
    for (const key of buckets) {
      const count = await this.redis.client.incr(key);
      if (count === 1) await this.redis.client.expire(key, 60);
      if (count > this.config.AUTH_LOGIN_RATE_PER_MIN) {
        this.logger.warn({ key, count }, 'Login rate-limit exceeded');
        throw new ForbiddenException('Too many login attempts. Try again later.');
      }
    }
  }
}
