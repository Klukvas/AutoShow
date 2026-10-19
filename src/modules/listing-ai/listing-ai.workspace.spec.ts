import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Listing } from '../listings/entities/listing.entity';
import { ListingAiService } from './listing-ai.service';

const actor = { id: 'actor', email: 'e@x', role: 'editor' as const };
const ready = {
  id: 'g1',
  listingId: 'listing',
  preset: 'standard',
  status: 'ready',
  failureReason: null,
  createdAt: new Date(),
  inputHash: 'old',
  result: { description: 'Опис', metaTitle: 'Заголовок', metaDescription: 'SEO', facts: [] },
  validation: { flags: [] as object[] },
  acceptedAt: null,
  acceptedFields: null,
};

function setup(
  row: object | null = ready,
  listing: object | null = { id: 'listing', status: 'published' },
) {
  const em = {
    findOne: jest.fn(async (entity: unknown) => (entity === Listing ? listing : row)),
    find: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const repo = {
    find: jest.fn().mockResolvedValue(row ? [row] : []),
    findOne: jest.fn().mockResolvedValue(row),
    manager: { transaction: jest.fn(async (fn: (m: typeof em) => unknown) => fn(em)) },
  };
  const inputs = { snapshot: jest.fn().mockResolvedValue({ inputHash: 'new' }) };
  const access = {
    permitted: jest.fn().mockResolvedValue(true),
    requireAllowed: jest.fn().mockResolvedValue(undefined),
    available: jest.fn().mockResolvedValue(true),
  };
  const credits = {
    hasCredit: jest.fn().mockResolvedValue(true),
    exhaustedReason: jest.fn().mockReturnValue('Генерації описів закінчилися — докупіть пакет.'),
  };
  const audit = { record: jest.fn() };
  const service = new ListingAiService(
    repo as never,
    {} as never,
    {} as never,
    inputs as never,
    access as never,
    credits as never,
    audit as never,
  );
  return { service, em, repo, access, credits, audit };
}

describe('ListingAiService.workspace', () => {
  it('tells a denied editor why and loads nothing', async () => {
    const { service, access, repo } = setup();
    access.permitted.mockResolvedValue(false);
    expect(await service.workspace('listing', actor)).toEqual({
      permitted: false,
      reason: expect.stringContaining('доступу'),
    });
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('reports per field which draft was taken, each with its own stale mark', async () => {
    const a = {
      ...ready,
      id: 'a',
      inputHash: 'new',
      acceptedAt: new Date(2),
      acceptedFields: ['description'],
    };
    const b = {
      ...ready,
      id: 'b',
      inputHash: 'old',
      acceptedAt: new Date(3),
      acceptedFields: ['metaTitle', 'metaDescription'],
    };
    const { service, repo } = setup();
    repo.find.mockResolvedValueOnce([b, a]).mockResolvedValueOnce([b, a]);
    const workspace = await service.workspace('listing', actor);
    if (!workspace.permitted) throw new Error('expected permitted');
    expect(workspace.accepted.description).toMatchObject({ id: 'a', isStale: false });
    expect(workspace.accepted.metaTitle).toMatchObject({ id: 'b', isStale: true });
    expect(workspace.accepted.metaDescription).toMatchObject({ id: 'b' });
  });

  it('marks drafts made from older listing data as stale and hides facts', async () => {
    const { service } = setup();
    const workspace = await service.workspace('listing', actor);
    expect(workspace).toMatchObject({ permitted: true, available: true, reason: null });
    if (!workspace.permitted) throw new Error('expected permitted');
    expect(workspace.drafts[0]).toMatchObject({ id: 'g1', isStale: true });
    expect(workspace.drafts[0].result).not.toHaveProperty('facts');
  });

  it('explains when the feature is off or the balance is empty', async () => {
    const off = setup();
    off.access.available.mockResolvedValue(false);
    expect(await off.service.workspace('listing', actor)).toMatchObject({
      available: false,
      reason: 'Генерація описів ШІ поки недоступна.',
    });
    const empty = setup();
    empty.credits.hasCredit.mockResolvedValue(false);
    expect(await empty.service.workspace('listing', actor)).toMatchObject({
      available: false,
      reason: expect.stringContaining('закінчилися'),
    });
  });
});

describe('ListingAiService.accept', () => {
  it('returns only the chosen texts, records who took them and audits', async () => {
    const { service, em, audit } = setup();
    expect(
      await service.accept(
        'listing',
        'g1',
        { fields: ['description', 'metaTitle'], confirmFlags: false },
        actor,
      ),
    ).toEqual({ description: 'Опис', metaTitle: 'Заголовок' });
    expect(em.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'g1' },
      {
        acceptedAt: expect.any(Date),
        acceptedBy: 'actor',
        acceptedFields: ['description', 'metaTitle'],
      },
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'listing_ai.accept',
        diff: expect.objectContaining({ confirmedFlags: 0 }),
      }),
      em,
    );
  });

  it('adds fields taken later from the same draft instead of replacing them', async () => {
    const { service, em } = setup({ ...ready, acceptedFields: ['description'] });
    await service.accept('listing', 'g1', { fields: ['metaTitle'], confirmFlags: false }, actor);
    expect(em.update.mock.calls[0][2]).toMatchObject({
      acceptedFields: ['description', 'metaTitle'],
    });
  });

  it('releases a field from the draft that owned it before, clearing a draft left with nothing', async () => {
    const { service, em } = setup();
    em.find.mockResolvedValue([
      { id: 'a', acceptedFields: ['description', 'metaTitle'] },
      { id: 'c', acceptedFields: ['description'] },
      { id: 'd', acceptedFields: ['metaDescription'] },
    ]);
    await service.accept('listing', 'g1', { fields: ['description'], confirmFlags: false }, actor);
    const calls = em.update.mock.calls.map(([, criteria, patch]) => [criteria, patch]);
    expect(calls).toEqual([
      [{ id: 'a' }, { acceptedFields: ['metaTitle'] }],
      [{ id: 'c' }, { acceptedAt: null, acceptedBy: null, acceptedFields: null }],
      [{ id: 'g1' }, expect.objectContaining({ acceptedFields: ['description'] })],
    ]);
  });

  it('asks to confirm only flags that touch the accepted texts', async () => {
    const seo = { reason: 'too_long', claim: '170', sourceField: null, field: 'metaDescription' };
    const { service } = setup({ ...ready, validation: { flags: [seo] } });
    await expect(
      service.accept('listing', 'g1', { fields: ['description'], confirmFlags: false }, actor),
    ).resolves.toEqual({ description: 'Опис' });
    await expect(
      service.accept('listing', 'g1', { fields: ['metaDescription'], confirmFlags: false }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses to accept into a sold or deleted listing', async () => {
    const sold = setup(ready, { id: 'listing', status: 'sold' });
    await expect(
      sold.service.accept('listing', 'g1', { fields: ['description'], confirmFlags: true }, actor),
    ).rejects.toThrow('Продане оголошення не можна змінювати.');
    const gone = setup(ready, null);
    await expect(
      gone.service.accept('listing', 'g1', { fields: ['description'], confirmFlags: true }, actor),
    ).rejects.toThrow('Оголошення не знайдено.');
    expect(sold.em.update).not.toHaveBeenCalled();
  });

  it('refuses a flagged draft until the flags are confirmed', async () => {
    const flag = { reason: 'mismatch', claim: '40 000 км', sourceField: 'mileageKm', field: null };
    const { service, em } = setup({ ...ready, validation: { flags: [flag] } });
    const error = await service
      .accept('listing', 'g1', { fields: ['description'], confirmFlags: false }, actor)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      error: 'ListingAiFlagsUnconfirmed',
    });
    expect(em.update).not.toHaveBeenCalled();
    await expect(
      service.accept('listing', 'g1', { fields: ['description'], confirmFlags: true }, actor),
    ).resolves.toEqual({ description: 'Опис' });
  });

  it('refuses a missing or unfinished draft', async () => {
    await expect(
      setup(null).service.accept(
        'listing',
        'g1',
        { fields: ['description'], confirmFlags: true },
        actor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      setup({ ...ready, status: 'processing', result: null }).service.accept(
        'listing',
        'g1',
        { fields: ['description'], confirmFlags: true },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
