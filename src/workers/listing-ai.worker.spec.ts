import { ForbiddenException } from '@nestjs/common';
import { TextAiError } from '../modules/ai-text/text-ai.provider';
import { ListingAiWorker } from './listing-ai.worker';

const input = {
  make: 'BMW',
  model: 'X5',
  generation: null,
  modification: null,
  year: 2021,
  mileageKm: 45000,
  bodyType: 'Позашляховик',
  fuelType: 'Дизель',
  transmission: 'Автомат',
  driveType: 'Повний',
  color: 'Чорний',
  engineVolumeL: 3,
  powerHp: 286,
  condition: 'used',
  ownersCount: 1,
  isCrashed: false,
  customsCleared: true,
  isNegotiable: false,
  locationCity: 'Київ',
  locationRegion: null,
  options: [],
  tags: [],
};
const answer = {
  description: 'BMW X5 2021 року в хорошому стані. Запишіться на огляд у Києві.',
  metaTitle: 'BMW X5 2021',
  metaDescription: 'BMW X5 2021 року. Перегляньте оголошення.',
  facts: [{ claim: '2021 року', sourceField: 'year', value: '2021' }],
};

function setup(row: Record<string, unknown> = {}) {
  const generation = {
    id: 'g1',
    listingId: 'listing',
    actorId: 'actor',
    preset: 'standard',
    model: 'gpt-fixture',
    status: 'processing',
    providerStartedAt: null,
    inputSnapshot: {
      input,
      photos: [
        { mediaId: 'm1', s3Key: 'r/1.jpg' },
        { mediaId: 'm2', s3Key: 'r/2.webp' },
        { mediaId: 'm3', s3Key: 'r/3.gif' },
      ],
    },
    ...row,
  };
  const updates: Array<[Record<string, unknown>, Record<string, unknown>]> = [];
  let current: Record<string, unknown> = generation;
  const em = {
    findOne: jest.fn().mockResolvedValue({ id: 'listing', status: 'published' }),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const repo = {
    update: jest.fn(async (criteria: Record<string, unknown>, patch: Record<string, unknown>) => {
      updates.push([criteria, patch]);
      current = { ...current, ...patch };
      return { affected: 1 };
    }),
    // Reflects the writes, so settlement sees the status the worker left.
    findOne: jest.fn(async () => current),
    find: jest.fn().mockResolvedValue([]),
    manager: { transaction: jest.fn(async (fn: (m: typeof em) => unknown) => fn(em)) },
  };
  const provider = {
    generate: jest.fn().mockResolvedValue({
      output: answer,
      model: 'gpt-fixture-2026',
      inputTokens: 2000,
      outputTokens: 500,
      latencyMs: 1234,
    }),
  };
  const drafts = { enqueue: jest.fn() };
  const access = {
    requireAllowed: jest.fn().mockResolvedValue(undefined),
    available: jest.fn().mockResolvedValue(true),
  };
  const credits = { settle: jest.fn(), sweep: jest.fn() };
  const storage = {
    head: jest.fn(async (key: string) => (key === 'r/2.webp' ? null : { size: 1000 })),
    getBuffer: jest.fn(async () => Buffer.from('image')),
  };
  const queue = { getJob: jest.fn().mockResolvedValue(null), upsertJobScheduler: jest.fn() };
  const config = {
    LISTING_AI_MAX_OUTPUT_TOKENS: 8000,
    LISTING_AI_TIMEOUT_SECONDS: 90,
    MEDIA_MAX_BYTES: 20_000_000,
    LISTING_AI_INPUT_USD_PER_MTOK: 1,
    LISTING_AI_OUTPUT_USD_PER_MTOK: 4,
  };
  const worker = new ListingAiWorker(
    repo as never,
    provider as never,
    drafts as never,
    access as never,
    credits as never,
    storage as never,
    queue as never,
    config as never,
  );
  const job = { name: 'generate', data: { generationId: 'g1' } } as never;
  const last = () => updates[updates.length - 1][1];
  return {
    worker,
    job,
    repo,
    em,
    provider,
    access,
    credits,
    storage,
    drafts,
    queue,
    updates,
    last,
  };
}

describe('ListingAiWorker', () => {
  it('turns a provider answer into a validated ready draft with metrics, then settles', async () => {
    const { worker, job, provider, credits, last, em } = setup();
    await worker.process(job);
    expect(em.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'g1', status: 'processing' }),
      { providerStartedAt: expect.any(Date) },
    );
    const request = provider.generate.mock.calls[0][0];
    expect(request).toMatchObject({
      model: 'gpt-fixture',
      schemaName: 'listing_description',
      maxOutputTokens: 8000,
      timeoutMs: 90_000,
    });
    // The webp without a head and the gif are skipped: photos are impression only.
    expect(request.images).toEqual([{ mime: 'image/jpeg', data: Buffer.from('image') }]);
    expect(request.text).toContain('Додано фото: 1');
    expect(last()).toMatchObject({
      status: 'ready',
      result: answer,
      validation: { flags: [] },
      model: 'gpt-fixture-2026',
      inputTokens: 2000,
      outputTokens: 500,
      latencyMs: 1234,
      costUsd: '0.004000',
    });
    expect(credits.settle).toHaveBeenCalledWith('g1', 'ready');
  });

  it('writes and checks with the brand voice frozen into the draft', async () => {
    const voice = { tone: 'Стримано', bannedWords: ['ідеальний'] };
    const { worker, job, provider, last } = setup({
      inputSnapshot: { input, photos: [], voice },
    });
    provider.generate.mockResolvedValue({
      output: { ...answer, description: `${answer.description} Ідеальний вибір.` },
      model: 'm',
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
    });
    await worker.process(job);
    expect(provider.generate.mock.calls[0][0].instructions).toContain('"""\nСтримано\n"""');
    expect(last().validation).toEqual({
      flags: expect.arrayContaining([
        expect.objectContaining({ reason: 'forbidden_content', claim: 'ідеальний' }),
      ]),
    });
  });

  it('does nothing when another worker already claimed the draft', async () => {
    const { worker, job, repo, provider } = setup();
    repo.update.mockResolvedValueOnce({ affected: 0 });
    await worker.process(job);
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it('fails without a paid call when access was revoked or the feature switched off', async () => {
    const denied = setup();
    denied.access.requireAllowed.mockRejectedValue(new ForbiddenException());
    await denied.worker.process(denied.job);
    expect(denied.provider.generate).not.toHaveBeenCalled();
    expect(denied.last()).toMatchObject({
      status: 'failed',
      failureReason: expect.stringContaining('доступу'),
    });
    const off = setup();
    off.access.available.mockResolvedValue(false);
    await off.worker.process(off.job);
    expect(off.provider.generate).not.toHaveBeenCalled();
    expect(off.last()).toMatchObject({
      status: 'failed',
      failureReason: 'Генерація описів ШІ поки недоступна.',
    });
  });

  it('fails without a paid call when the listing was sold or deleted', async () => {
    const { worker, job, em, provider, last } = setup();
    em.findOne.mockResolvedValue(null);
    await worker.process(job);
    expect(provider.generate).not.toHaveBeenCalled();
    expect(last()).toMatchObject({
      status: 'failed',
      failureReason: expect.stringContaining('продано'),
    });
  });

  it('records billed usage of a failed provider answer with a safe message', async () => {
    const { worker, job, provider, last } = setup();
    provider.generate.mockRejectedValue(
      new TextAiError('incomplete', 'max_output_tokens').withUsage({
        model: 'gpt-fixture-2026',
        inputTokens: 2000,
        outputTokens: 8000,
        latencyMs: 90_000,
      }),
    );
    await worker.process(job);
    expect(last()).toMatchObject({
      status: 'failed',
      failureReason: 'ШІ не завершив відповідь. Спробуйте ще раз.',
      outputTokens: 8000,
      costUsd: '0.034000',
    });
  });

  it('fails a malformed answer and never stores it', async () => {
    const { worker, job, provider, last } = setup();
    provider.generate.mockResolvedValue({
      output: { description: '' },
      model: 'm',
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
    });
    await worker.process(job);
    // Billed tokens are kept even though the answer is unusable.
    expect(last()).toMatchObject({ status: 'failed', inputTokens: 1, outputTokens: 1 });
    expect(last()).not.toHaveProperty('result');
  });

  it('treats a database error at the paid-intent step as a generic failure, not a sale', async () => {
    const { worker, job, repo, provider, last, credits } = setup();
    repo.manager.transaction.mockRejectedValueOnce(new Error('pool exhausted'));
    await worker.process(job);
    expect(provider.generate).not.toHaveBeenCalled();
    expect(last()).toMatchObject({
      status: 'failed',
      failureReason: 'Не вдалося створити опис. Спробуйте ще раз.',
    });
    expect(credits.settle).toHaveBeenCalledWith('g1', 'failed');
  });

  it('hides unexpected errors behind a generic message', async () => {
    const { worker, job, provider, last } = setup();
    provider.generate.mockRejectedValue(new Error('socket hang up at 10.0.0.1'));
    await worker.process(job);
    expect(last()).toMatchObject({ failureReason: 'Не вдалося створити опис. Спробуйте ще раз.' });
  });

  describe('recovery', () => {
    it('re-enqueues queued drafts and never re-runs a draft whose paid call may have happened', async () => {
      const { worker, repo, drafts, updates, credits } = setup();
      repo.find.mockResolvedValueOnce([{ id: 'q1' }]).mockResolvedValueOnce([
        { id: 'paid', providerStartedAt: new Date() },
        { id: 'unpaid', providerStartedAt: null },
      ]);
      await worker.process({ name: 'recover', data: {} } as never);
      expect(drafts.enqueue.mock.calls.map(([id]) => id)).toEqual(['q1', 'unpaid']);
      expect(updates).toEqual([
        [
          { id: 'paid', status: 'processing' },
          { status: 'interrupted', failureReason: expect.any(String) },
        ],
        [{ id: 'unpaid', status: 'processing' }, { status: 'queued' }],
      ]);
      expect(credits.sweep).toHaveBeenCalled();
    });

    it('skips a draft whose job is still active and sweeps credits even if recovery fails', async () => {
      const { worker, repo, queue, updates, credits } = setup();
      repo.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'busy', providerStartedAt: new Date() }]);
      queue.getJob.mockResolvedValue({ getState: async () => 'active' });
      await worker.process({ name: 'recover', data: {} } as never);
      expect(updates).toEqual([]);
      repo.find.mockRejectedValueOnce(new Error('db down'));
      await worker.process({ name: 'recover', data: {} } as never);
      expect(credits.sweep).toHaveBeenCalledTimes(2);
    });
  });
});
