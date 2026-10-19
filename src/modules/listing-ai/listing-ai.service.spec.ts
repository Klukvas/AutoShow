import { ConflictException, HttpException, ServiceUnavailableException } from '@nestjs/common';
import { ListingAiGeneration } from './entities/listing-ai-generation.entity';
import { Listing } from '../listings/entities/listing.entity';
import { ListingAiService } from './listing-ai.service';

const actor = { id: 'actor', email: 'e@x', role: 'editor' as const };
const snapshot = {
  input: { make: 'BMW' },
  photos: [{ mediaId: 'm1', s3Key: 'r/1.jpg' }],
  inputHash: 'a'.repeat(64),
};
const dto = { requestId: '11111111-1111-4111-8111-111111111111', preset: 'standard' as const };

function setup(
  overrides: { repeated?: object | null; inFlight?: object | null; recent?: number } = {},
) {
  const findOne = jest.fn(async (entity: unknown, options: { where: Record<string, unknown> }) => {
    if (entity === Listing) return { id: 'listing', status: 'published' };
    if ('requestId' in options.where) return overrides.repeated ?? null;
    return overrides.inFlight ?? null;
  });
  const em = {
    query: jest.fn(),
    findOne,
    count: jest.fn().mockResolvedValue(overrides.recent ?? 0),
    create: jest.fn((_entity: unknown, value: object) => value),
    save: jest.fn(async (_entity: unknown, value: object) => ({ ...value, id: 'generation' })),
  };
  const repo = {
    findOne: jest.fn().mockResolvedValue(overrides.repeated ?? null),
    manager: { transaction: jest.fn(async (fn: (m: typeof em) => unknown) => fn(em)) },
  };
  const queue = { getJob: jest.fn().mockResolvedValue(null), add: jest.fn() };
  const inputs = { snapshot: jest.fn().mockResolvedValue(snapshot) };
  const access = {
    requireAllowed: jest.fn().mockResolvedValue(undefined),
    available: jest.fn().mockResolvedValue(true),
  };
  const credits = { reserve: jest.fn().mockResolvedValue(undefined) };
  const audit = { record: jest.fn() };
  const service = new ListingAiService(
    repo as never,
    queue as never,
    { LISTING_AI_JOBS_PER_HOUR: 3, LISTING_AI_MODEL: 'gpt-fixture' } as never,
    inputs as never,
    access as never,
    credits as never,
    audit as never,
  );
  return { service, em, queue, access, credits, audit, inputs };
}

describe('ListingAiService.enqueue', () => {
  it.each([
    ['failed', true],
    ['completed', true],
    ['waiting', false],
    ['active', false],
  ])('a %s job is replaced: %s', async (state, replaced) => {
    const { service, queue } = setup();
    const old = { getState: async () => state, remove: jest.fn() };
    queue.getJob.mockResolvedValue(old);
    await service.enqueue('g1');
    expect(old.remove).toHaveBeenCalledTimes(replaced ? 1 : 0);
    expect(queue.add).toHaveBeenCalledTimes(replaced ? 1 : 0);
  });
});

describe('ListingAiService.create', () => {
  it('stores the frozen input, reserves one description, audits and enqueues after commit', async () => {
    const { service, em, queue, credits, audit } = setup();
    const row = await service.create('listing', dto, actor);
    expect(em.save).toHaveBeenCalledWith(
      ListingAiGeneration,
      expect.objectContaining({
        listingId: 'listing',
        preset: 'standard',
        inputHash: snapshot.inputHash,
        inputSnapshot: { input: snapshot.input, photos: snapshot.photos },
        photoMediaIds: ['m1'],
        model: 'gpt-fixture',
        status: 'queued',
      }),
    );
    expect(credits.reserve).toHaveBeenCalledWith(em, 'generation', actor);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'listing_ai.generate', entityId: 'listing' }),
      em,
    );
    expect(queue.add).toHaveBeenCalledWith(
      'generate',
      { generationId: 'generation' },
      expect.objectContaining({ jobId: 'listing-ai-generation', attempts: 1 }),
    );
    expect(row.id).toBe('generation');
  });

  it('returns the same row for a repeated request id and refuses it with other settings', async () => {
    const repeated = { id: 'old', listingId: 'listing', preset: 'standard', status: 'ready' };
    const same = setup({ repeated });
    expect(await same.service.create('listing', dto, actor)).toBe(repeated);
    // Answered before the relation-heavy snapshot.
    expect(same.inputs.snapshot).not.toHaveBeenCalled();
    expect(same.em.save).not.toHaveBeenCalled();
    expect(same.queue.add).not.toHaveBeenCalled();
    const changed = setup({ repeated: { ...repeated, preset: 'short' } });
    await expect(changed.service.create('listing', dto, actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('reuses an identical draft already in flight instead of paying twice', async () => {
    const inFlight = { id: 'running', status: 'processing' };
    const { service, em, credits, queue, audit } = setup({ inFlight });
    expect(await service.create('listing', dto, actor)).toBe(inFlight);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'listing_ai.generate_reused', actorId: 'actor' }),
      em,
    );
    expect(em.save).not.toHaveBeenCalled();
    expect(credits.reserve).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('refuses when switched off and over the hourly limit, saving nothing', async () => {
    const off = setup();
    off.access.available.mockResolvedValue(false);
    await expect(off.service.create('listing', dto, actor)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    const busy = setup({ recent: 3 });
    const error = await busy.service.create('listing', dto, actor).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect(off.em.save).not.toHaveBeenCalled();
    expect(busy.em.save).not.toHaveBeenCalled();
  });

  it('keeps the queued row when the queue is down', async () => {
    const { service, queue } = setup();
    queue.add.mockRejectedValue(new Error('redis down'));
    await expect(service.create('listing', dto, actor)).resolves.toMatchObject({
      status: 'queued',
    });
  });

  it('checks access before loading anything', async () => {
    const { service, access, em } = setup();
    access.requireAllowed.mockRejectedValue(new Error('denied'));
    await expect(service.create('listing', dto, actor)).rejects.toThrow('denied');
    expect(em.findOne).not.toHaveBeenCalled();
  });
});
