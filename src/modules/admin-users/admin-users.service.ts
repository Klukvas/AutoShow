import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { IsNull, Not, Repository } from 'typeorm';
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

    const user = this.users.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      role,
      isActive: true,
    });
    const saved = await catchUniqueViolation(() => this.users.save(user), 'Email already in use');
    await this.audit.record({
      action: 'admin_user.create',
      entityType: 'admin_user',
      entityId: saved.id,
      diff: { email: saved.email, role: saved.role },
      actorId: actor.id,
      actorRole: actor.role,
    });
    return this.safe(saved);
  }

  async update(
    id: string,
    dto: UpdateAdminUserDto,
    actor: AuthenticatedUser,
  ): Promise<AdminUserView> {
    const user = await this.users.findOne({ where: { id, deletedAt: IsNull() } });
    if (!user) throw new NotFoundException('User not found');
    if (id === actor.id && (dto.role || dto.isActive === false)) {
      throw new BadRequestException('Cannot change your own role or disable your own account');
    }
    // Demoting or disabling the last active admin would lock the whole panel.
    const losesAdmin =
      user.role === 'admin' &&
      user.isActive &&
      ((dto.role && dto.role !== 'admin') || dto.isActive === false);
    if (losesAdmin) await this.assertNotLastAdmin(id);
    const patch: Partial<AdminUser> = {};
    if (dto.role) patch.role = dto.role;
    if (typeof dto.isActive === 'boolean') patch.isActive = dto.isActive;
    if (dto.password) {
      patch.passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
      patch.failedLoginAttempts = 0;
      patch.lockedUntil = null;
    }
    const saved = await this.users.save({ ...user, ...patch });
    if (dto.password || dto.role || typeof dto.isActive === 'boolean') {
      await this.tokens.revokeAllForUser(saved.id);
    }
    await this.audit.record({
      action: 'admin_user.update',
      entityType: 'admin_user',
      entityId: id,
      diff: { ...patch, passwordHash: undefined },
      actorId: actor.id,
      actorRole: actor.role,
    });
    return this.safe(saved);
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const user = await this.users.findOne({ where: { id, deletedAt: IsNull() } });
    if (!user) throw new NotFoundException('User not found');
    if (id === actor.id) {
      throw new BadRequestException('Cannot delete your own account');
    }
    if (user.role === 'admin' && user.isActive) await this.assertNotLastAdmin(id);
    await this.users.softRemove(user);
    await this.tokens.revokeAllForUser(user.id);
    await this.audit.record({
      action: 'admin_user.delete',
      entityType: 'admin_user',
      entityId: id,
      actorId: actor.id,
      actorRole: actor.role,
    });
  }

  /** Reject an operation that would leave zero active admins besides `excludeId`. */
  private async assertNotLastAdmin(excludeId: string): Promise<void> {
    const others = await this.users.count({
      where: { role: 'admin', isActive: true, deletedAt: IsNull(), id: Not(excludeId) },
    });
    if (others === 0) {
      throw new BadRequestException('Cannot remove the last active admin');
    }
  }

  private safe(user: AdminUser): AdminUserView {
    const safe = { ...user } as Partial<AdminUser>;
    delete safe.passwordHash;
    return safe as AdminUserView;
  }
}
