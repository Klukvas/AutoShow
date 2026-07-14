import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AdminRole } from '../../modules/admin-users/entities/admin-user.entity';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: AdminRole;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (!req.user) {
      throw new Error('CurrentUser decorator used on a route without auth guard');
    }
    return req.user;
  },
);
