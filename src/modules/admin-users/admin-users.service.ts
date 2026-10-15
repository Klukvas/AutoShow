import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { EntityManager, IsNull, Not, Repository } from 'typeorm';
import { catchUniqueViolation } from '../../common/db/conflict';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthTokenService } from '../auth/auth-token.service';
import { AdminUser } from './entities/admin-user.entity';
import { CreateAdminUserDto, UpdateAdminUserDto } from './dto/create-admin-user.dto';

export type AdminUserView = Omit<AdminUser, 'passwordHash'>;

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(AdminUser)
    private readonly users: Repository<AdminUser>,
    private readonly audit: AuditLogService,
    private readonly tokens: AuthTokenService,
  ) {}

  async list(): Promise<AdminUserView[]> {
    const users = await this.users.find({
      where: { deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return users.map((user) => this.safe(user));
  }

  async create(dto: CreateAdminUserDto, actor: AuthenticatedUser): Promise<AdminUserView> {
    const role = dto.role ?? 'editor';

    const existing = await this.users.findOne({
      where: { email: dto.email.toLowerCase(), deletedAt: IsNull() },
    });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    return this.users.manager.transaction(async (em) => {
      await this.lockTeam(em, actor);
      const repo = em.getRepository(AdminUser);
      const user = repo.create({
        email: dto.email.toLowerCase(),
        passwordHash,
        role,
        isActive: true,
      });
      const saved = await catchUniqueViolation(() => repo.save(user), 'Email already in use');
      await this.audit.record(
        {
          action: 'admin_user.create',
          entityType: 'admin_user',
          entityId: saved.id,
          diff: { email: saved.email, role: saved.role },
          actorId: actor.id,
          actorRole: actor.role,
        },
        em,
      );
      return this.safe(saved);
    });
  }

  async update(
    id: string,
    dto: UpdateAdminUserDto,
    actor: AuthenticatedUser,
  ): Promise<AdminUserView> {
    if (id === actor.id && (dto.role || dto.isActive === false)) {
      throw new BadRequestException('Cannot change your own role or disable your own account');
    }
    const patch: Partial<AdminUser> = {
      ...(dto.role ? { role: dto.role } : {}),
      ...(typeof dto.isActive === 'boolean' ? { isActive: dto.isActive } : {}),
      ...(dto.password
        ? {
            passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }),
            failedLoginAttempts: 0,
            lockedUntil: null,
          }
        : {}),
    };
    return this.users.manager.transaction(async (em) => {
      await this.lockTeam(em, actor);
      const user = await this.lockUser(em, id);
      const losesAdmin =
        user.role === 'admin' &&
        user.isActive &&
        ((dto.role && dto.role !== 'admin') || dto.isActive === false);
      if (losesAdmin) await this.assertNotLastAdmin(em, id);
      const changed = await em.update(
        AdminUser,
        { id, deletedAt: IsNull(), version: user.version },
        { ...patch, authVersion: () => 'auth_version + 1' },
      );
      if (changed.affected !== 1) throw new ConflictException('User changed; reload and retry');
      await this.audit.record(
        {
          action: 'admin_user.update',
          entityType: 'admin_user',
          entityId: id,
          diff: { ...patch, passwordHash: undefined },
          actorId: actor.id,
          actorRole: actor.role,
        },
        em,
      );
      const saved = await em.findOne(AdminUser, { where: { id, deletedAt: IsNull() } });
      if (!saved) throw new NotFoundException('User not found');
      return this.safe(saved);
    });
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    if (id === actor.id) throw new BadRequestException('Cannot delete your own account');
    await this.users.manager.transaction(async (em) => {
      await this.lockTeam(em, actor);
      const user = await this.lockUser(em, id);
      if (user.role === 'admin' && user.isActive) await this.assertNotLastAdmin(em, id);
      const changed = await em.update(
        AdminUser,
        { id, deletedAt: IsNull(), version: user.version },
        {
          deletedAt: new Date(),
          authVersion: () => 'auth_version + 1',
        },
      );
      if (changed.affected !== 1) throw new ConflictException('User changed; reload and retry');
      await this.audit.record(
        {
          action: 'admin_user.delete',
          entityType: 'admin_user',
          entityId: id,
          actorId: actor.id,
          actorRole: actor.role,
        },
        em,
      );
    });
  }

  private async lockTeam(em: EntityManager, actor: AuthenticatedUser): Promise<void> {
    // Global team lock precedes row locks, serializing the last-admin invariant.
    await em.query('SELECT pg_advisory_xact_lock($1, $2)', [1718986095, 1]);
    const current = await em.findOne(AdminUser, { where: { id: actor.id, deletedAt: IsNull() } });
    if (!current?.isActive || current.role !== 'admin')
      throw new ForbiddenException('Admin access required');
  }

  private async lockUser(em: EntityManager, id: string): Promise<AdminUser> {
    const user = await em.findOne(AdminUser, {
      where: { id, deletedAt: IsNull() },
      lock: { mode: 'pessimistic_write' },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async assertNotLastAdmin(em: EntityManager, excludeId: string): Promise<void> {
    const others = await em.count(AdminUser, {
      where: { role: 'admin', isActive: true, deletedAt: IsNull(), id: Not(excludeId) },
    });
    if (others === 0) throw new BadRequestException('Cannot remove the last active admin');
  }

  private safe(user: AdminUser): AdminUserView {
    const safe = { ...user } as Partial<AdminUser>;
    delete safe.passwordHash;
    return safe as AdminUserView;
  }
}
