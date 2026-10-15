import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AdminUser } from '../admin-users/entities/admin-user.entity';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuthTokenService } from './auth-token.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: AuthTokenService,
    private readonly reflector: Reflector,
    @InjectRepository(AdminUser) private readonly users: Repository<AdminUser>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = header.slice(7);
    const payload = this.tokens.verifyAccess(token);

    const user = await this.users.findOne({ where: { id: payload.sub, deletedAt: IsNull() } });
    if (
      !user?.isActive ||
      !Number.isInteger(payload.authVersion) ||
      payload.authVersion !== user.authVersion
    ) {
      throw new UnauthorizedException('Access token has been revoked');
    }
    req.user = { id: user.id, email: user.email, role: user.role };
    return true;
  }
}
