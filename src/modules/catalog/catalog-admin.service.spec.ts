import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Make } from './entities/make.entity';
import { Model } from './entities/model.entity';
import { CatalogAdminService } from './catalog-admin.service';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const actor = { id: 'editor', role: 'editor' } as AuthenticatedUser;
function fixture() {
  const repository = () => ({
    findOne: jest.fn(async () => ({ id: 'id', slug: 'test', makeId: 'make' })),
    find: jest.fn(async (): Promise<unknown[]> => []),
    count: jest.fn(async () => 0),
    update: jest.fn(async () => ({ affected: 1 })),
    create: jest.fn((value: unknown) => value),
    save: jest.fn(async (value: unknown) => ({ id: 'saved', ...(value as object) })),
    softDelete: jest.fn(async () => ({ affected: 1 })),
  });
  const makes = repository(),
    models = repository(),
    listings = repository(),
    colors = repository();
  const catalog = { invalidate: jest.fn(async () => undefined) },
    audit = { record: jest.fn(async () => undefined) },
    queue = { add: jest.fn(async () => undefined) };
  Object.assign(makes, {
    manager: {
      transaction: async (run: (manager: unknown) => unknown) =>
        run({
          getRepository: (entity: unknown) =>
            entity === Make ? makes : entity === Model ? models : listings,
        }),
    },
  });
  const service = new CatalogAdminService(
    makes as never,
    models as never,
    repository() as never,
    repository() as never,
    repository() as never,
    repository() as never,
    colors as never,
    repository() as never,
    repository() as never,
    repository() as never,
    listings as never,
    catalog as never,
    audit as never,
    queue as never,
    { publicUrlFor: (key: string) => key } as never,
  );
  return { service, makes, models, listings, colors, catalog, audit };
}
const model = { nameUk: 'A4', slug: 'a4', makeId: 'make' };
describe('catalog management integrity', () => {
  it('requires an active parent before creating or updating models', async () => {
    const f = fixture();
    f.makes.findOne.mockResolvedValue(null as never);
    await expect(f.service.createModel(model, actor)).rejects.toBeInstanceOf(NotFoundException);
    await expect(f.service.updateModel('id', model, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(f.models.save).not.toHaveBeenCalled();
    expect(f.models.update).not.toHaveBeenCalled();
  });
  it('does not reparent models or update an unknown model', async () => {
    const f = fixture();
    await expect(
      f.service.updateModel('id', { ...model, makeId: 'foreign' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    f.models.findOne.mockResolvedValue(null as never);
    await expect(f.service.updateModel('id', model, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it('blocks referenced deletion, including make models and make/model listings', async () => {
    const f = fixture();
    f.models.count.mockResolvedValue(1);
    await expect(f.service.deleteMake('id', actor)).rejects.toBeInstanceOf(ConflictException);
    f.models.count.mockResolvedValue(0);
    f.listings.count.mockResolvedValue(1);
    await expect(f.service.deleteMake('id', actor)).rejects.toBeInstanceOf(ConflictException);
    await expect(f.service.deleteModel('id', actor)).rejects.toBeInstanceOf(ConflictException);
    expect(f.makes.softDelete).not.toHaveBeenCalled();
    expect(f.models.softDelete).not.toHaveBeenCalled();
  });
  it('turns duplicate update into 409 and updates only requested metadata', async () => {
    const f = fixture();
    f.models.update.mockRejectedValueOnce({ code: '23505' } as never);
    await expect(f.service.updateModel('id', model, actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await f.service.updateMake('id', { nameUk: 'New', slug: 'test' }, actor);
    expect(f.makes.update).toHaveBeenCalledWith('id', { nameUk: 'New', slug: 'test' });
    expect(f.makes.save).not.toHaveBeenCalled();
  });
});

const color = (id: string, slug: string, nameUk: string) => ({ id, slug, nameUk });
describe('adding a color by name', () => {
  it('generates a transliterated slug and keeps cache invalidation + audit', async () => {
    const f = fixture();
    const saved = await f.service.createColor({ nameUk: '  Бежевий ' }, actor);
    expect(saved).toMatchObject({ nameUk: 'Бежевий', slug: 'bezhevyi' });
    expect(f.colors.save).toHaveBeenCalledTimes(1);
    expect(f.catalog.invalidate).toHaveBeenCalledTimes(1);
    expect(f.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'catalog.color.create', actorRole: 'editor' }),
    );
  });
  it('returns the alive color with the same name instead of creating a duplicate', async () => {
    const f = fixture();
    const existing = color('beige-id', 'beige', 'Бежевий');
    f.colors.find.mockResolvedValue([color('red-id', 'red', 'Червоний'), existing]);
    await expect(f.service.createColor({ nameUk: 'бежевий' }, actor)).resolves.toBe(existing);
    await expect(f.service.createColor({ nameUk: '  БЕЖЕВИЙ  ' }, actor)).resolves.toBe(existing);
    expect(f.colors.save).not.toHaveBeenCalled();
    expect(f.audit.record).not.toHaveBeenCalled();
  });
  it('suffixes the generated slug when another color already owns it', async () => {
    const f = fixture();
    f.colors.find.mockResolvedValue([
      color('a', 'bezhevyi', 'Бежевий металік'),
      color('b', 'bezhevyi-2', 'Бежевий матовий'),
    ]);
    // Different name, same transliteration (apostrophe and case are dropped).
    const saved = await f.service.createColor({ nameUk: 'Беж’евий' }, actor);
    expect(saved).toMatchObject({ slug: 'bezhevyi-3' });
  });
  it('falls back to a generic slug when the name has no latin equivalent', async () => {
    const f = fixture();
    f.colors.find.mockResolvedValue([color('a', 'color', '???')]);
    await expect(f.service.createColor({ nameUk: '★' }, actor)).resolves.toMatchObject({
      slug: 'color-2',
    });
  });
  it('returns the color created by a concurrent request on a unique violation', async () => {
    const f = fixture();
    const raced = color('raced', 'bezhevyi', 'Бежевий');
    f.colors.find.mockResolvedValueOnce([]).mockResolvedValueOnce([raced]);
    f.colors.save.mockRejectedValueOnce({ code: '23505' } as never);
    await expect(f.service.createColor({ nameUk: 'Бежевий' }, actor)).resolves.toBe(raced);
  });
  it('keeps the 409 when the conflicting row is a different color', async () => {
    const f = fixture();
    f.colors.save.mockRejectedValueOnce({ code: '23505' } as never);
    await expect(f.service.createColor({ nameUk: 'Бежевий' }, actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
