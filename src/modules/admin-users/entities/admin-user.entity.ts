import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base/base.entity';

export type AdminRole = 'admin' | 'editor';

/**
 * Admin panel account. `admin` has full access (listings, leads, team,
 * branding, audit, catalog); `editor` manages listings and leads only.
 * Email is unique among alive (not soft-deleted) rows.
 */
@Entity('admin_users')
@Index('uq_admin_users_email_alive', ['email'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class AdminUser extends BaseEntity {
  @Column({ type: 'varchar', length: 254 })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 512, select: false })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 32 })
  role!: AdminRole;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @Column({ name: 'failed_login_attempts', type: 'int', default: 0 })
  failedLoginAttempts!: number;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil!: Date | null;
}
