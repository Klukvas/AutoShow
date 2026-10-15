import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  readSession: vi.fn(),
  writeSession: vi.fn(),
  clearSession: vi.fn(),
  refresh: vi.fn(),
  currentUser: vi.fn(),
}));
vi.mock('./session', () => ({ ...mocks, refreshRetryProof: () => 'a'.repeat(64) }));
vi.mock('@/lib/api/admin', () => ({ adminApi: mocks }));
vi.mock('@/lib/api/client', () => ({
  ApiClientError: class ApiClientError extends Error {
    constructor(public status: number) {
      super('Unauthorized');
    }
  },
}));
afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});
it('late old-cookie callers revalidate recovery after logout instead of using a settled memo', async () => {
  const { ApiClientError } = await import('@/lib/api/client');
  mocks.readSession.mockResolvedValue({
    accessToken: 'old',
    refreshToken: 'old-refresh',
    accessExpiresAt: 1,
    refreshExpiresAt: 9999999999,
    user: { id: 'u', role: 'admin', email: 'test' },
  });
  mocks.refresh.mockResolvedValueOnce({
    accessToken: 'winner',
    refreshToken: 'next',
    accessExpiresIn: 900,
    refreshExpiresIn: 600,
  });
  const { refreshSession } = await import('./refresh');
  expect((await refreshSession())?.accessToken).toBe('winner');
  mocks.refresh.mockRejectedValueOnce(
    new ApiClientError(401, { statusCode: 401, message: 'Unauthorized', error: 'Unauthorized' }),
  );
  expect(await refreshSession()).toBeNull();
  expect(mocks.refresh).toHaveBeenCalledTimes(2);
  expect(mocks.refresh).toHaveBeenCalledWith('old-refresh', 'a'.repeat(64));
  expect(mocks.writeSession).toHaveBeenCalledTimes(1);
  expect(mocks.clearSession).toHaveBeenCalledTimes(1);
});
it('a revoked unexpired access token goes through rotation and clears on rejection', async () => {
  const { ApiClientError } = await import('@/lib/api/client');
  mocks.readSession.mockResolvedValue({
    accessToken: 'revoked',
    refreshToken: 'old-refresh',
    accessExpiresAt: 9999999999,
    user: { id: 'u', role: 'admin', email: 'test' },
  });
  mocks.currentUser.mockRejectedValue(
    new ApiClientError(401, { statusCode: 401, message: 'Unauthorized', error: 'Unauthorized' }),
  );
  mocks.refresh.mockRejectedValue(
    new ApiClientError(401, { statusCode: 401, message: 'Unauthorized', error: 'Unauthorized' }),
  );
  const { refreshSession } = await import('./refresh');
  expect(await refreshSession()).toBeNull();
  expect(mocks.clearSession).toHaveBeenCalledTimes(1);
});

it('an overlapping old-cookie request while the first cookie write is paused receives the same recovered successor', async () => {
  mocks.readSession.mockResolvedValue({
    accessToken: 'old',
    refreshToken: 'old-refresh',
    accessExpiresAt: 1,
    user: { id: 'u', role: 'admin', email: 'test' },
  });
  const fresh = {
    accessToken: 'winner',
    refreshToken: 'successor',
    accessExpiresIn: 900,
    refreshExpiresIn: 600,
  };
  mocks.refresh.mockImplementation(async (_token, proof) => {
    expect(proof).toBe('a'.repeat(64));
    return fresh;
  });
  let entered!: () => void;
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  mocks.writeSession.mockImplementationOnce(async () => {
    entered();
    await gate;
  });
  const { refreshSession } = await import('./refresh');
  const first = refreshSession();
  await ready;
  const second = await refreshSession();
  release();
  expect((await first)?.session.refreshToken).toBe('successor');
  expect(second?.session.refreshToken).toBe('successor');
  expect(mocks.refresh).toHaveBeenCalledTimes(2);
  expect(mocks.clearSession).not.toHaveBeenCalled();
});
