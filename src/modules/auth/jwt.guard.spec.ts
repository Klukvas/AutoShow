import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt.guard';

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  it('lets public routes through without a token', async () => {
    const reflector = { getAllAndOverride: jest.fn(() => true) };
    const tokens = { verifyAccess: jest.fn(), isAccessTokenRevoked: jest.fn() };
    const guard = new JwtAuthGuard(tokens as never, reflector as never);
    await expect(guard.canActivate(contextFor({ headers: {} }))).resolves.toBe(true);
    expect(tokens.verifyAccess).not.toHaveBeenCalled();
  });

  it('rejects a request without a bearer token', async () => {
    const reflector = { getAllAndOverride: jest.fn(() => false) };
    const tokens = { verifyAccess: jest.fn(), isAccessTokenRevoked: jest.fn() };
    const guard = new JwtAuthGuard(tokens as never, reflector as never);
    await expect(guard.canActivate(contextFor({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a revoked (pre-cutoff) access token', async () => {
    const reflector = { getAllAndOverride: jest.fn(() => false) };
    const tokens = {
      verifyAccess: jest.fn(() => ({ sub: 'u', email: 'e', role: 'admin', iat: 1 })),
      isAccessTokenRevoked: jest.fn().mockResolvedValue(true),
    };
    const guard = new JwtAuthGuard(tokens as never, reflector as never);
    await expect(
      guard.canActivate(contextFor({ headers: { authorization: 'Bearer token' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('populates req.user from a valid token', async () => {
    const reflector = { getAllAndOverride: jest.fn(() => false) };
    const tokens = {
      verifyAccess: jest.fn(() => ({
        sub: 'user-a',
        email: 'a@example.test',
        role: 'admin',
        iat: 123,
      })),
      isAccessTokenRevoked: jest.fn().mockResolvedValue(false),
    };
    const guard = new JwtAuthGuard(tokens as never, reflector as never);
    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer token' },
    };
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({
      id: 'user-a',
      email: 'a@example.test',
      role: 'admin',
    });
  });
});
