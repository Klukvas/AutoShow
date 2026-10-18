import {
  BadRequestException,
  ForbiddenException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PhotoAiService } from './photo-ai.service';
import { PhotoAiGeneration } from './entities/photo-ai-generation.entity';
import { ListingMedia } from '../listings/entities/listing-media.entity';
import { Listing } from '../listings/entities/listing.entity';
import { BUILTIN_PHOTO_PRESETS, effectivePrompt } from './photo-ai.prompts';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const actor: AuthenticatedUser = { id: 'actor', email: 'editor@example.com', role: 'editor' };
const dto = {
  requestId: 'request',
  category: 'enhance' as const,
  prompt: 'Improve exposure naturally',
};
function setup(credits: object = ownKeyCredits) {
  const media = {
    id: 'media',
    listingId: 'listing',
    status: 'ready',
    type: 'image',
    originalS3Key: 'immutable.jpg',
    aiRevision: 2,
    activeAiVariant: null,
  };
  const generation = {
    id: 'generation',
    mediaId: 'media',
    status: 'ready',
    manifest: { generationId: 'generation', s3Key: 'new.png', sceneAltered: true, renditions: [] },
    createdAt: new Date(),
    category: 'scene',
  };
  const em = {
    findOne: jest.fn(async (entity: unknown) =>
      entity === ListingMedia
        ? media
        : entity === Listing
          ? { id: 'listing' }
          : entity === PhotoAiGeneration
            ? null
            : null,
    ),
    count: jest.fn().mockResolvedValue(0),
    query: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    create: jest.fn((_entity: unknown, value: unknown) => value),
    save: jest.fn(async (_entity: unknown, value: object) => ({
      ...value,
      id: 'generation',
      createdAt: new Date(),
    })),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    }),
  };
  const repo = {
    manager: { ...em, transaction: jest.fn(async (fn: (m: typeof em) => unknown) => fn(em)) },
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
  };
  const queue = { getJob: jest.fn().mockResolvedValue(null), add: jest.fn() };
  const provider = { availability: jest.fn().mockReturnValue({ enabled: true, reason: null }) };
  const audit = { record: jest.fn() };
  const access = {
    requireAllowed: jest.fn().mockResolvedValue(undefined),
    permission: jest.fn().mockResolvedValue({ permitted: true, permissionReason: null }),
  };
  const service = new PhotoAiService(
    repo as never,
    repo as never,
    queue as never,
    provider as never,
    { publicUrlFor: (key: string) => `https://media/${key}` } as never,
    audit as never,
    { PHOTO_AI_JOBS_PER_HOUR: 10, PHOTO_AI_TIMEOUT_SECONDS: 240 } as never,
    access as never,
    credits as never,
  );
  return { service, media, generation, em, repo, queue, provider, audit, access };
}
/** own_key mode: the credit service never limits or reserves anything. */
const ownKeyCredits = { reserve: async () => undefined, hasCredit: async () => true };
describe('PhotoAiService', () => {
  it('resolves a builtin preset by id: stores the id and wishes, never the preset text', async () => {
    const { service, em } = setup();
    const studio = BUILTIN_PHOTO_PRESETS.find((preset) => preset.id === 'studio');
    const view = await service.generate(
      'media',
      { requestId: 'request', category: 'scene', presetId: 'studio', prompt: ' darker floor ' },
      actor,
    );
    const saved = em.save.mock.calls[0][1] as Record<string, string>;
    expect(saved).toMatchObject({ presetId: 'studio', prompt: 'darker floor', category: 'scene' });
    expect(saved.effectivePrompt).toContain(studio?.instructions);
    expect(saved.effectivePrompt).toContain('darker floor');
    expect(view).toMatchObject({ presetId: 'studio', presetName: 'Світла студія' });
    expect(JSON.stringify(view)).not.toContain(studio?.instructions);
  });
  it('accepts a preset without wishes but rejects a preset from the other mode', async () => {
    const { service, em } = setup();
    await service.generate(
      'media',
      { requestId: 'request', category: 'enhance', presetId: 'natural' },
      actor,
    );
    expect(em.save.mock.calls[0][1]).toMatchObject({ presetId: 'natural', prompt: '' });
    await expect(
      service.generate(
        'media',
        { requestId: 'other', category: 'enhance', presetId: 'studio' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('requires a real instruction when no preset is chosen', async () => {
    const { service, em } = setup();
    await expect(
      service.generate('media', { requestId: 'request', category: 'scene', prompt: ' ab ' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(em.save).not.toHaveBeenCalled();
  });
  it('exposes builtin names and descriptions but no instructions', async () => {
    const { service, repo } = setup();
    repo.find.mockResolvedValue([]);
    const workspace = (await service.workspace('media', actor)) as { builtins: object[] };
    expect(workspace.builtins).toHaveLength(BUILTIN_PHOTO_PRESETS.length);
    for (const preset of workspace.builtins) {
      expect(Object.keys(preset).sort()).toEqual(['category', 'description', 'id', 'name']);
    }
  });
  it('shows old rows that stored a builtin text as that preset, without the text', () => {
    const { service } = setup();
    const view = service.generationView({
      id: 'old',
      category: 'scene',
      presetId: null,
      prompt: 'Place the car on a quiet city street in soft morning daylight.',
      status: 'ready',
      createdAt: new Date(),
      manifest: null,
    } as never);
    expect(view).toMatchObject({ presetId: 'morning', presetName: 'Місто вранці', prompt: '' });
  });
  it('creates from the immutable original even if an AI variant is applied', async () => {
    const { service, media, em } = setup();
    Object.assign(media, { activeAiVariant: { s3Key: 'already-ai.png' } });
    await service.generate('media', dto, actor);
    expect(em.save).toHaveBeenCalledWith(
      PhotoAiGeneration,
      expect.objectContaining({
        sourceS3Key: 'immutable.jpg',
        effectivePrompt: effectivePrompt({ category: 'enhance', ownerRequest: dto.prompt }),
      }),
    );
  });
  it('keeps a durable queued row when queue unavailable', async () => {
    const { service, queue } = setup();
    queue.add.mockRejectedValue(new Error('redis'));
    expect(await service.generate('media', dto, actor)).toMatchObject({ status: 'queued' });
  });
  it('rejects unavailable generation before saving', async () => {
    const { service, provider, em } = setup();
    provider.availability.mockReturnValue({ enabled: false, reason: null });
    await expect(service.generate('media', dto, actor)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(em.save).not.toHaveBeenCalled();
  });
  it('rejects over-quota and an existing in-flight generation', async () => {
    const { service, em } = setup();
    em.count.mockResolvedValue(10);
    await expect(service.generate('media', dto, actor)).rejects.toMatchObject({ status: 429 });
    em.count.mockResolvedValue(0);
    em.createQueryBuilder().getOne.mockResolvedValue({ id: 'busy' });
    await expect(service.generate('media', dto, actor)).rejects.toBeInstanceOf(ConflictException);
  });
  it('does not return idempotent generation after the media was deleted', async () => {
    const { service, em } = setup();
    em.findOne.mockImplementation(async (entity) =>
      entity === PhotoAiGeneration ? ({ fingerprint: 'irrelevant' } as never) : null,
    );
    await expect(service.generate('media', dto, actor)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('applies only reviewed ready variants and rejects stale revision without writes', async () => {
    const { service, em, media, generation } = setup();
    em.findOne.mockImplementation(async (entity) =>
      entity === ListingMedia
        ? media
        : entity === Listing
          ? ({ id: 'listing' } as never)
          : (generation as never),
    );
    await expect(
      service.apply(
        'media',
        { generationId: 'generation', reviewed: false, expectedRevision: 2 },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.apply(
        'media',
        { generationId: 'generation', reviewed: true, expectedRevision: 1 },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(em.update).not.toHaveBeenCalled();
    expect(
      await service.apply(
        'media',
        { generationId: 'generation', reviewed: true, expectedRevision: 2 },
        actor,
      ),
    ).toEqual({ revision: 3, activeGenerationId: 'generation' });
    expect(em.update).toHaveBeenCalledWith(
      ListingMedia,
      { id: 'media' },
      { activeAiVariant: generation.manifest, aiRevision: 3 },
    );
    expect(media.originalS3Key).toBe('immutable.jpg');
  });
  it('restores only the active pointer and increments revision', async () => {
    const { service, media, em } = setup();
    Object.assign(media, { activeAiVariant: { generationId: 'generation' } });
    expect(await service.restore('media', 2, actor)).toEqual({
      revision: 3,
      activeGenerationId: null,
    });
    expect(em.update).toHaveBeenCalledWith(
      ListingMedia,
      { id: 'media' },
      { activeAiVariant: null, aiRevision: 3 },
    );
    expect(media.originalS3Key).toBe('immutable.jpg');
  });
  it('removes retained failed/completed queue jobs before re-enqueueing', async () => {
    for (const state of ['failed', 'completed']) {
      const { service, queue } = setup();
      const old = { getState: jest.fn().mockResolvedValue(state), remove: jest.fn() };
      queue.getJob.mockResolvedValue(old);
      await service.enqueue('generation');
      expect(old.remove).toHaveBeenCalled();
      expect(queue.add).toHaveBeenCalledWith(
        'generate',
        { generationId: 'generation' },
        expect.objectContaining({ attempts: 1 }),
      );
    }
  });
  it('does not replace an active queue job', async () => {
    const { service, queue } = setup();
    queue.getJob.mockResolvedValue({
      getState: jest.fn().mockResolvedValue('active'),
      remove: jest.fn(),
    });
    await service.enqueue('generation');
    expect(queue.add).not.toHaveBeenCalled();
  });
  it('retains quota history and late-upload grace before reclaim', async () => {
    const { service, repo } = setup();
    repo.findOne.mockResolvedValue({ id: 'recent-generation' });
    expect(await service.safeToReclaim('media')).toBe(false);
    expect(repo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: [
          expect.objectContaining({ updatedAt: expect.anything() }),
          expect.objectContaining({ createdAt: expect.anything() }),
        ],
      }),
    );
  });
});

describe('PhotoAiService access enforcement', () => {
  it('returns permission only for denied staff, independent of provider configuration', async () => {
    const { service, access, repo, provider } = setup();
    access.permission.mockResolvedValue({ permitted: false, permissionReason: 'Denied by owner' });
    expect(await service.workspace('media', actor)).toEqual({
      permitted: false,
      permissionReason: 'Denied by owner',
    });
    expect(repo.find).not.toHaveBeenCalled();
    expect(provider.availability).not.toHaveBeenCalled();
  });
  it('keeps permission separate from configured provider availability for allowed staff', async () => {
    const { service, provider } = setup();
    provider.availability.mockReturnValue({ enabled: false, reason: 'Unavailable' });
    expect(await service.workspace('media', actor)).toMatchObject({
      permitted: true,
      enabled: false,
    });
  });
  it('denies every mutation including an idempotent generation request before returning existing data', async () => {
    const { service, access, em } = setup();
    access.requireAllowed.mockRejectedValue(new ForbiddenException('Denied by owner'));
    for (const operation of [
      () => service.generate('media', dto, actor),
      () =>
        service.apply(
          'media',
          { generationId: 'generation', reviewed: true, expectedRevision: 2 },
          actor,
        ),
      () => service.restore('media', 2, actor),
      () =>
        service.savePreset(
          { name: 'Preset', category: 'enhance', prompt: 'Improve exposure' },
          actor,
        ),
    ])
      await expect(operation()).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.findOne).not.toHaveBeenCalled();
    expect(em.save).not.toHaveBeenCalled();
    expect(access.requireAllowed).toHaveBeenCalledWith(actor.id);
  });
});

describe('PhotoAiService in managed mode', () => {
  const emptyCredits = (reserve = jest.fn()) => ({
    hasCredit: jest.fn().mockResolvedValue(false),
    exhaustedReason: (role: string) =>
      role === 'admin' ? 'Фото закінчилися — докупіть пакет.' : 'Обробка ШІ недоступна.',
    reserve,
  });

  it('tells an editor only that AI is unavailable — no balance or price', async () => {
    const { service } = setup(emptyCredits());
    const workspace = await service.workspace('media', actor);
    expect(workspace).toMatchObject({ enabled: false, reason: 'Обробка ШІ недоступна.' });
    expect(Object.keys(workspace)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/balance|price|pack|credit|available/i)]),
    );
    expect((workspace as { reason: string }).reason).not.toMatch(/пакет|₴/);
  });

  it('tells the admin to buy a pack when photos ran out', async () => {
    const { service } = setup(emptyCredits());
    await expect(service.workspace('media', { ...actor, role: 'admin' })).resolves.toMatchObject({
      enabled: false,
      reason: 'Фото закінчилися — докупіть пакет.',
    });
  });

  it('keeps the provider reason when AI itself is switched off', async () => {
    const credits = emptyCredits();
    const { service, provider } = setup(credits);
    provider.availability.mockReturnValue({
      enabled: false,
      reason: 'Обробка ШІ поки недоступна.',
    });
    await expect(service.workspace('media', actor)).resolves.toMatchObject({
      enabled: false,
      reason: 'Обробка ШІ поки недоступна.',
    });
    expect(credits.hasCredit).not.toHaveBeenCalled();
  });

  it('reserves a photo inside the generation transaction and enqueues the job', async () => {
    const reserve = jest.fn().mockResolvedValue(undefined);
    const { service, em, queue } = setup({ ...emptyCredits(reserve), hasCredit: async () => true });
    await service.generate('media', dto, actor);
    expect(reserve).toHaveBeenCalledWith(em, 'generation', actor);
    expect(queue.add).toHaveBeenCalled();
  });

  it('creates no job when the reservation is refused', async () => {
    const refusal = new Error('Фото закінчилися');
    const reserve = jest.fn().mockRejectedValue(refusal);
    const { service, queue, audit } = setup(emptyCredits(reserve));
    await expect(service.generate('media', dto, actor)).rejects.toBe(refusal);
    expect(queue.add).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('does not reserve again for an idempotent repeat of the same request', async () => {
    const reserve = jest.fn().mockResolvedValue(undefined);
    const { service, em } = setup({ ...emptyCredits(reserve), hasCredit: async () => true });
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(['media', dto.category, dto.prompt]))
      .digest('hex');
    em.findOne.mockImplementation(async (entity: unknown) =>
      entity === PhotoAiGeneration
        ? { id: 'generation', status: 'queued', fingerprint, createdAt: new Date() }
        : entity === Listing
          ? { id: 'listing' }
          : { id: 'media', listingId: 'listing', status: 'ready', type: 'image' },
    );
    await service.generate('media', dto, actor);
    expect(reserve).not.toHaveBeenCalled();
  });
});
