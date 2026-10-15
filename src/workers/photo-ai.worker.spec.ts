import { ForbiddenException } from '@nestjs/common';
import sharp from 'sharp';
import { PhotoAiWorker } from './photo-ai.worker';

function setup() {
  const generation = {
    id: 'g',
    mediaId: 'm',
    listingId: 'l',
    actorId: 'actor',
    category: 'scene',
    sourceS3Key: 'original.jpg',
    effectivePrompt: 'protected',
    status: 'processing',
    providerStartedAt: null,
    outputStoredAt: null,
  };
  const update = jest.fn().mockResolvedValue({ affected: 1 });
  const repo = {
    update,
    findOne: jest.fn().mockResolvedValue(generation),
    find: jest.fn().mockResolvedValue([]),
    manager: {
      transaction: jest.fn(async (fn) =>
        fn({
          update: (_entity: unknown, criteria: unknown, values: unknown) =>
            update(criteria, values),
        }),
      ),
    },
  };
  const photos = {
    liveMedia: jest.fn().mockResolvedValue({}),
    enqueue: jest.fn(),
  };
  const provider = { edit: jest.fn() };
  const storage = {
    head: jest.fn(),
    getBuffer: jest.fn(),
    putBuffer: jest.fn(),
    delete: jest.fn(),
  };
  const queue = { getJob: jest.fn().mockResolvedValue(null), upsertJobScheduler: jest.fn() };
  const access = { requireAllowed: jest.fn().mockResolvedValue(undefined) };
  const worker = new PhotoAiWorker(
    repo as never,
    photos as never,
    provider as never,
    storage as never,
    queue as never,
    { PHOTO_AI_TIMEOUT_SECONDS: 10, MEDIA_MAX_BYTES: 20_000_000 } as never,
    access as never,
  );
  return { worker, repo, generation, photos, provider, storage, queue, access };
}
describe('PhotoAiWorker', () => {
  it('never calls provider on redelivery once queued claim has been consumed', async () => {
    const { worker, repo, provider } = setup();
    repo.update.mockResolvedValue({ affected: 0 });
    await worker.process({ name: 'generate', data: { generationId: 'g' } } as never);
    expect(provider.edit).not.toHaveBeenCalled();
  });
  it('persists provider intent, produces all renditions and does not activate automatically', async () => {
    const { worker, repo, provider, storage } = setup();
    const image = await sharp({
      create: { width: 40, height: 20, channels: 3, background: '#888' },
    })
      .png()
      .toBuffer();
    storage.head.mockResolvedValue({ size: image.length });
    storage.getBuffer.mockResolvedValue(image);
    provider.edit.mockResolvedValue(image);
    await worker.process({ name: 'generate', data: { generationId: 'g' } } as never);
    expect(provider.edit).toHaveBeenCalledTimes(1);
    expect(repo.update.mock.calls.findIndex((c) => c[1].providerStartedAt)).toBeGreaterThanOrEqual(
      0,
    );
    expect(storage.putBuffer).toHaveBeenCalledTimes(10);
    expect(repo.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'ready',
        manifest: expect.objectContaining({
          sceneAltered: true,
          renditions: expect.arrayContaining([
            expect.objectContaining({ variant: 'thumb', format: 'jpeg' }),
          ]),
        }),
      }),
    );
    expect(repo.update.mock.calls.every((c) => !('activeAiVariant' in c[1]))).toBe(true);
  });
  it('resumes stored output using local transforms without another paid call', async () => {
    const { worker, generation, provider, storage } = setup();
    generation.outputStoredAt = new Date() as never;
    generation.providerStartedAt = new Date() as never;
    const image = await sharp({
      create: { width: 40, height: 20, channels: 3, background: '#888' },
    })
      .png()
      .toBuffer();
    storage.head.mockResolvedValue({ size: image.length });
    storage.getBuffer.mockResolvedValue(image);
    await worker.process({ name: 'generate', data: { generationId: 'g' } } as never);
    expect(provider.edit).not.toHaveBeenCalled();
    expect(storage.putBuffer).toHaveBeenCalledTimes(9);
  });
  it('discards output after media deletion without resurrecting or activating', async () => {
    const { worker, photos, repo, generation, storage } = setup();
    generation.outputStoredAt = new Date() as never;
    const image = await sharp({
      create: { width: 40, height: 20, channels: 3, background: '#888' },
    })
      .png()
      .toBuffer();
    storage.head.mockResolvedValue({ size: image.length });
    storage.getBuffer.mockResolvedValue(image);
    photos.liveMedia.mockResolvedValueOnce({}).mockRejectedValue(new Error('deleted'));
    await worker.process({ name: 'generate', data: { generationId: 'g' } } as never);
    expect(repo.update).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'ready' }),
    );
    expect(storage.delete).toHaveBeenCalledTimes(10);
  });
  it('does not start paid intent after the listing is sold', async () => {
    const { worker, photos, provider, storage, repo } = setup();
    const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#888' } })
      .png()
      .toBuffer();
    storage.head.mockResolvedValue({ size: image.length });
    storage.getBuffer.mockResolvedValue(image);
    photos.liveMedia
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('Sold listings are read-only'));
    await worker.process({ name: 'generate', data: { generationId: 'g' } } as never);
    expect(provider.edit).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ providerStartedAt: expect.any(Date) }),
    );
  });
  it('marks unknown paid outcome interrupted with sanitized error and no automatic retry', async () => {
    const { worker, generation, provider, storage, repo } = setup();
    const image = await sharp({
      create: { width: 40, height: 20, channels: 3, background: '#888' },
    })
      .png()
      .toBuffer();
    storage.head.mockResolvedValue({ size: image.length });
    storage.getBuffer.mockResolvedValue(image);
    provider.edit.mockImplementation(async () => {
      generation.providerStartedAt = new Date() as never;
      throw new Error('secret-token');
    });
    await worker.process({ name: 'generate', data: { generationId: 'g' } } as never);
    expect(repo.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'interrupted',
        failureReason: expect.not.stringContaining('secret-token'),
      }),
    );
    expect(provider.edit).toHaveBeenCalledTimes(1);
  });
  it('recovers queued jobs and interrupted paid intent without generating again', async () => {
    const { worker, generation, repo, photos, provider, storage } = setup();
    generation.providerStartedAt = new Date() as never;
    repo.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'queued' }])
      .mockResolvedValueOnce([generation]);
    storage.head.mockResolvedValue(null);
    await worker.recover();
    expect(photos.enqueue).toHaveBeenCalledWith('queued');
    expect(provider.edit).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'interrupted' }),
    );
  });
  it('retries terminal artifact cleanup on live media and marks success', async () => {
    const { worker, repo, generation, storage } = setup();
    repo.find
      .mockResolvedValueOnce([generation])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    await worker.recover();
    expect(storage.delete).toHaveBeenCalledTimes(10);
    expect(repo.update).toHaveBeenCalledWith({ id: 'g' }, { artifactsCleanedAt: expect.any(Date) });
  });
});

describe('Queued photo AI policy revocation', () => {
  it('fails revoked queued actor before provider intent with no provider call', async () => {
    const { worker, access, storage, provider, repo } = setup();
    const image = await sharp({
      create: { width: 20, height: 10, channels: 3, background: '#777' },
    })
      .png()
      .toBuffer();
    storage.head.mockResolvedValue({ size: image.length });
    storage.getBuffer.mockResolvedValue(image);
    access.requireAllowed.mockRejectedValue(new ForbiddenException());
    await worker.process({ name: 'generate', data: { generationId: 'g' } } as never);
    expect(provider.edit).not.toHaveBeenCalled();
    expect(repo.update.mock.calls.some((call) => call[1].providerStartedAt)).toBe(false);
    expect(repo.update).toHaveBeenCalledWith(
      { id: 'g', status: 'processing' },
      {
        status: 'failed',
        failureReason: 'Власник сайту не надав вам доступу до обробки фото з ШІ.',
      },
    );
  });
});
