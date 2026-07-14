import { SetMetadata } from '@nestjs/common';
import type { AdminRole } from '../../modules/admin-users/entities/admin-user.entity';

export const ROLES_KEY = 'roles';

export type Role = AdminRole;

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
