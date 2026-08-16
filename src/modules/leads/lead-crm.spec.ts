import { NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { LeadsService } from './leads.service';

const actor = { id: 'u1', role: 'editor', email: 'e@x' } as AuthenticatedUser;

/** Exercise the CRM methods on a prototype instance with mocked repos. */
function makeService() {
  const svc = Object.create(LeadsService.prototype) as LeadsService & Record<string, unknown>;
  const leads = { findOne: jest.fn(), save: jest.fn(async (x: unknown) => x) };
  const adminUsers = { findOne: jest.fn() };
  const notes = {
    create: jest.fn((x: unknown) => x),
    save: jest.fn(async (x: Record<string, unknown>) => ({ id: 'n1', ...x })),
    find: jest.fn(),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  Object.assign(svc, { leads, adminUsers, notes, audit });
  return { svc, leads, adminUsers, notes, audit };
}

describe('LeadsService CRM', () => {
  describe('assign', () => {
    it('404s when the lead is missing', async () => {
      const { svc, leads } = makeService();
      leads.findOne.mockResolvedValue(null);
      await expect(svc.assign('l1', 'u2', actor)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s when the assignee is missing or inactive', async () => {
      const { svc, leads, adminUsers } = makeService();
      leads.findOne.mockResolvedValue({ id: 'l1', assigneeId: null });
      adminUsers.findOne.mockResolvedValue(null);
      await expect(svc.assign('l1', 'u2', actor)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('assigns and audits when the assignee is valid', async () => {
      const { svc, leads, adminUsers, audit } = makeService();
      leads.findOne.mockResolvedValue({ id: 'l1', assigneeId: null });
      adminUsers.findOne.mockResolvedValue({ id: 'u2' });
      const saved = await svc.assign('l1', 'u2', actor);
      expect(saved).toMatchObject({ id: 'l1', assigneeId: 'u2' });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'lead.assign', diff: { from: null, to: 'u2' } }),
      );
    });

    it('unassigns (null) without touching the admin-users repo', async () => {
      const { svc, leads, adminUsers } = makeService();
      leads.findOne.mockResolvedValue({ id: 'l1', assigneeId: 'u2' });
      const saved = await svc.assign('l1', null, actor);
      expect(saved).toMatchObject({ assigneeId: null });
      expect(adminUsers.findOne).not.toHaveBeenCalled();
    });
  });

  describe('addNote', () => {
    it('appends a note stamped with the author and audits', async () => {
      const { svc, leads, notes, audit } = makeService();
      leads.findOne.mockResolvedValue({ id: 'l1' });
      const note = await svc.addNote('l1', 'Called, will call back', actor);
      expect(notes.create).toHaveBeenCalledWith(
        expect.objectContaining({ leadId: 'l1', authorId: 'u1', authorRole: 'editor' }),
      );
      expect(note).toMatchObject({ id: 'n1', text: 'Called, will call back' });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'lead.note' }));
    });

    it('404s when adding a note to a missing lead', async () => {
      const { svc, leads } = makeService();
      leads.findOne.mockResolvedValue(null);
      await expect(svc.addNote('l1', 'x', actor)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
