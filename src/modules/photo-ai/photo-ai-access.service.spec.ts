import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PhotoAiAccessService } from './photo-ai-access.service';

const ADMIN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EDITOR = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OTHER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
function setup() {
  let users = [
    {
      id: ADMIN,
      email: 'owner@example.test',
      role: 'admin',
      isActive: true,
      deletedAt: null as Date | null,
    },
    {
      id: EDITOR,
      email: 'editor@example.test',
      role: 'editor',
      isActive: true,
      deletedAt: null as Date | null,
    },
    {
      id: OTHER,
      email: 'other@example.test',
      role: 'editor',
      isActive: true,
      deletedAt: null as Date | null,
    },
  ];
  let policy: { accessMode: string; selectedEditorIds: unknown } = {
    accessMode: 'all',
    selectedEditorIds: [],
  };
  const eligible = () => users.filter((u) => u.isActive && !u.deletedAt && u.role === 'editor');
  const repo = {
    findOne: jest.fn(
      async ({ where }: { where: { id: string } }) =>
        users.find((u) => u.id === where.id && u.isActive && !u.deletedAt) ?? null,
    ),
    find: jest.fn(async (_options: unknown) =>
      eligible().map((u) => ({ ...u, passwordHash: 'must-not-return', failedLoginAttempts: 99 })),
    ),
    count: jest.fn(
      async ({ where }: { where: { id: { value: string[] } } }) =>
        eligible().filter((u) => where.id.value.includes(u.id)).length,
    ),
  };
  const settings = { findOne: jest.fn(async () => policy) };
  const service = new PhotoAiAccessService(repo as never, settings as never);
  return {
    service,
    repo,
    settings,
    setPolicy: (next: typeof policy) => {
      policy = next;
    },
    setUser: (id: string, patch: Partial<(typeof users)[number]>) => {
      users = users.map((u) => (u.id === id ? { ...u, ...patch } : u));
    },
  };
}
describe('Photo AI live access policy', () => {
  it('default all allows live employees independent of provider key state', async () => {
    const { service, settings } = setup();
    expect(await service.permission(EDITOR)).toEqual({ permitted: true, permissionReason: null });
    expect(settings.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ select: ['accessMode', 'selectedEditorIds'] }),
    );
    expect(await service.permission(ADMIN)).toEqual({ permitted: true, permissionReason: null });
  });
  it('admins mode keeps live admins and denies all editors', async () => {
    const { service, setPolicy } = setup();
    setPolicy({ accessMode: 'admins', selectedEditorIds: [] });
    await expect(service.requireAllowed(ADMIN)).resolves.toBeUndefined();
    await expect(service.requireAllowed(EDITOR)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('selected mode allows only selected current active editors and always admins', async () => {
    const { service, setPolicy } = setup();
    setPolicy({ accessMode: 'selected', selectedEditorIds: [EDITOR] });
    expect((await service.permission(EDITOR)).permitted).toBe(true);
    expect((await service.permission(OTHER)).permitted).toBe(false);
    expect((await service.permission(ADMIN)).permitted).toBe(true);
  });
  it('fresh role/account reads deny inactive/deleted accounts and demoted stale admins; promoted active admins retain access', async () => {
    const { service, setPolicy, setUser } = setup();
    setPolicy({ accessMode: 'admins', selectedEditorIds: [] });
    setUser(ADMIN, { role: 'editor' });
    await expect(service.requireAdmin(ADMIN)).rejects.toBeInstanceOf(ForbiddenException);
    expect((await service.permission(ADMIN)).permitted).toBe(false);
    setUser(EDITOR, { role: 'admin' });
    expect((await service.permission(EDITOR)).permitted).toBe(true);
    setUser(EDITOR, { isActive: false });
    expect((await service.permission(EDITOR)).permitted).toBe(false);
    setUser(OTHER, { role: 'admin', deletedAt: new Date() });
    expect((await service.permission(OTHER)).permitted).toBe(false);
  });
  it('rejects nonexistent/admin/inactive/deleted/duplicate selected IDs', async () => {
    const { service, setUser } = setup();
    await expect(service.validateSelected([EDITOR])).resolves.toBeUndefined();
    for (const ids of [[ADMIN], [EDITOR, EDITOR], ['dddddddd-dddd-4ddd-8ddd-dddddddddddd']])
      await expect(service.validateSelected(ids)).rejects.toBeInstanceOf(BadRequestException);
    setUser(EDITOR, { isActive: false });
    await expect(service.validateSelected([EDITOR])).rejects.toBeInstanceOf(BadRequestException);
    setUser(OTHER, { deletedAt: new Date() });
    await expect(service.validateSelected([OTHER])).rejects.toBeInstanceOf(BadRequestException);
  });
  it('admin-only staff list projects id/email without auth fields or truncation', async () => {
    const { service, repo } = setup();
    const list = await service.staff(ADMIN);
    expect(list).toEqual([
      { id: EDITOR, email: 'editor@example.test' },
      { id: OTHER, email: 'other@example.test' },
    ]);
    expect(repo.find.mock.calls[0][0]).not.toHaveProperty('take');
    await expect(service.staff(EDITOR)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('fails closed for corrupt policy payloads while active admin override remains', async () => {
    const { service, setPolicy } = setup();
    for (const policy of [
      { accessMode: 'selected', selectedEditorIds: null },
      { accessMode: 'selected', selectedEditorIds: EDITOR },
      { accessMode: 'selected', selectedEditorIds: [EDITOR, EDITOR] },
      { accessMode: 'all', selectedEditorIds: ['not-uuid'] },
      { accessMode: 'invalid', selectedEditorIds: [] },
    ]) {
      setPolicy(policy);
      expect((await service.permission(EDITOR)).permitted).toBe(false);
      expect((await service.permission(ADMIN)).permitted).toBe(true);
    }
  });
});
