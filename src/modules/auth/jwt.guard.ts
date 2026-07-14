import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
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

    // Stateless access tokens survive a password change / role change / disable
    // / delete until they expire — unless the user has a revocation cut-off.
    if (await this.tokens.isAccessTokenRevoked(payload.sub, payload.iat)) {
      throw new UnauthorizedException('Access token has been revoked');
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    return true;
  }
}
