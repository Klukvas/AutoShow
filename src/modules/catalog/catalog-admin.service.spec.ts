import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Make } from './entities/make.entity';
import { Model } from './entities/model.entity';
import { CatalogAdminService } from './catalog-admin.service';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const actor = { id: 'editor', role: 'editor' } as AuthenticatedUser;
function fixture() {
  const repository = () => ({
    findOne: jest.fn(async () => ({ id: 'id', slug: 'test', makeId: 'make' })),
    count: jest.fn(async () => 0),
    update: jest.fn(async () => ({ affected: 1 })),
    create: jest.fn((value: unknown) => value),
    save: jest.fn(async (value: unknown) => ({ id: 'saved', ...(value as object) })),
    softDelete: jest.fn(async () => ({ affected: 1 })),
  });
  const makes = repository(),
    models = repository(),
    listings = repository();
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
    repository() as never,
    repository() as never,
    repository() as never,
    repository() as never,
    listings as never,
    catalog as never,
    audit as never,
    queue as never,
    { publicUrlFor: (key: string) => key } as never,
  );
  return { service, makes, models, listings };
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
