import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { ALL_ENTITIES } from '../../database/entities';
import { Listing } from '../listings/entities/listing.entity';
import { ListingMedia } from '../listings/entities/listing-media.entity';
import { MediaRendition } from '../listings/entities/media-rendition.entity';
import { PhotoAiGeneration } from '../photo-ai/entities/photo-ai-generation.entity';
import { PhotoAiPreset } from '../photo-ai/entities/photo-ai-preset.entity';
import { PhotoAiService } from '../photo-ai/photo-ai.service';
import { MediaService } from './media.service';
import { MediaProcessorWorker } from '../../workers/media-processor.worker';
const integration = process.env.AUDIT_TEST_PG_PORT ? describe : describe.skip;
integration('sold listing media (real PostgreSQL locks)', () => {
  let db: DataSource;
  let listing: Listing;
  let media: ListingMedia;
  const actor = { id: randomUUID(), email: 'fixture@test', role: 'admin' as const };
  const storage = {
    presignPut: jest.fn(async () => ({ uploadUrl: 'fixture', expiresIn: 60 })),
    head: jest.fn(),
    getBuffer: jest.fn(),
    putBuffer: jest.fn(),
    delete: jest.fn(async () => undefined),
    publicUrlFor: (key: string) => key,
  };
  const queue = { add: jest.fn(), remove: jest.fn(async () => undefined), getJob: jest.fn() };
  const audit = { record: jest.fn() };
  let photos: PhotoAiService;
  let service: MediaService;
  beforeAll(async () => {
    db = await new DataSource({
      type: 'postgres',
      host: '127.0.0.1',
      port: Number(process.env.AUDIT_TEST_PG_PORT),
      username: 'audit_test',
      database: 'postgres',
      entities: ALL_ENTITIES,
      synchronize: true,
    }).initialize();
    const ids: string[] = [];
    for (const table of [
      'catalog_makes',
      'catalog_body_types',
      'catalog_fuel_types',
      'catalog_transmissions',
      'catalog_drive_types',
      'catalog_colors',
    ]) {
      const id = randomUUID();
      ids.push(id);
      // Table names are fixed test literals above; values remain parameters.
      await db.query(`INSERT INTO ${table}(id,name_uk,slug) VALUES($1,$2,$3)`, [id, 'Fixture', id]);
    }
    const model = randomUUID();
    await db.query('INSERT INTO catalog_models(id,make_id,name_uk,slug) VALUES($1,$2,$3,$4)', [
      model,
      ids[0],
      'Fixture',
      model,
    ]);
    listing = await db.getRepository(Listing).save({
      slug: randomUUID(),
      makeId: ids[0],
      modelId: model,
      bodyTypeId: ids[1],
      fuelTypeId: ids[2],
      transmissionId: ids[3],
      driveTypeId: ids[4],
      colorId: ids[5],
      year: 2020,
      mileageKm: 100,
      engineVolumeL: '2.0',
      powerHp: 100,
      condition: 'used',
      priceAmount: '100',
      priceCurrency: 'USD',
      priceNormalized: '100',
      title: 'Fixture',
      description: 'Fixture',
      locationCity: 'Fixture',
      status: 'sold',
    });
    media = await db.getRepository(ListingMedia).save({
      listingId: listing.id,
      type: 'image',
      status: 'ready',
      originalS3Key: 'fixture/original.png',
      mime: 'image/png',
    });
    photos = new PhotoAiService(
      db.getRepository(PhotoAiGeneration),
      db.getRepository(PhotoAiPreset),
      queue as never,
      { availability: async () => ({ enabled: true }) } as never,
      storage as never,
      audit as never,
      { PHOTO_AI_JOBS_PER_HOUR: 10 } as never,
      {
        requireAllowed: async () => undefined,
        permission: async () => ({ permitted: true }),
      } as never,
    );
    service = new MediaService(
      db.getRepository(ListingMedia),
      db.getRepository(MediaRendition),
      db.getRepository(Listing),
      storage as never,
      audit as never,
      queue as never,
      { MEDIA_MAX_BYTES: 100000 } as never,
      photos,
    );
  });
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
  });
  it('blocks every ordinary media write before storage/queue effects and preserves AI history reads', async () => {
    const calls = [
      () =>
        service.beginUpload(listing.id, {
          type: 'image',
          contentType: 'image/png',
          filename: 'x.png',
          sizeBytes: 100,
        }),
      () => service.confirm(media.id, actor),
      () => service.retry(media.id, actor),
      () => service.reorder(listing.id, [media.id], actor),
      () => service.setCover(listing.id, media.id, actor),
      () => service.remove(media.id, actor),
    ];
    for (const call of calls) await expect(call()).rejects.toThrow('read-only');
    expect(storage.presignPut).not.toHaveBeenCalled();
    expect(storage.head).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
    await expect(photos.workspace(media.id, actor)).resolves.toMatchObject({ mediaId: media.id });
  });
  it('blocks AI generate/apply/restore while keeping the original state', async () => {
    await expect(
      photos.generate(
        media.id,
        { requestId: randomUUID(), category: 'enhance', prompt: 'Fixture' },
        actor,
      ),
    ).rejects.toThrow('read-only');
    await expect(
      photos.apply(
        media.id,
        { generationId: randomUUID(), expectedRevision: 0, reviewed: true },
        actor,
      ),
    ).rejects.toThrow('read-only');
    await expect(photos.restore(media.id, 0, actor)).rejects.toThrow('read-only');
    expect(await db.getRepository(ListingMedia).findOneByOrFail({ id: media.id })).toMatchObject({
      aiRevision: 0,
      activeAiVariant: null,
    });
  });
  it('a waiting upload sees a sale committed by a different connection', async () => {
    await db.getRepository(Listing).update(listing.id, { status: 'published' });
    const holder = db.createQueryRunner();
    await holder.connect();
    await holder.startTransaction();
    await holder.manager.findOne(Listing, {
      where: { id: listing.id },
      lock: { mode: 'pessimistic_write' },
    });
    const pending = service.beginUpload(listing.id, {
      type: 'image',
      contentType: 'image/png',
      filename: 'x.png',
      sizeBytes: 100,
    });
    const rejected = expect(pending).rejects.toThrow('read-only');
    await new Promise((resolve) => setTimeout(resolve, 50));
    await holder.manager.update(Listing, listing.id, { status: 'sold' });
    await holder.commitTransaction();
    await holder.release();
    await rejected;
    expect(storage.presignPut).not.toHaveBeenCalled();
  });
  it('invalid confirmation persists failed state despite returning a validation error', async () => {
    await db.getRepository(Listing).update(listing.id, { status: 'published' });
    await db.getRepository(ListingMedia).update(media.id, { status: 'pending' });
    storage.head.mockResolvedValue({ size: 100, contentType: 'video/mp4' } as never);
    await expect(service.confirm(media.id, actor)).rejects.toThrow('content type');
    expect(await db.getRepository(ListingMedia).findOneByOrFail({ id: media.id })).toMatchObject({
      status: 'failed',
      failureReason: 'uploaded content type does not match requested media type',
    });
  });
  it('retry enqueue failure persists its recovery reason', async () => {
    storage.head.mockResolvedValue({ size: 100, contentType: 'image/png' } as never);
    queue.add.mockRejectedValueOnce(new Error('fixture queue offline') as never);
    await expect(service.retry(media.id, actor)).rejects.toThrow('fixture queue offline');
    expect(await db.getRepository(ListingMedia).findOneByOrFail({ id: media.id })).toMatchObject({
      status: 'failed',
      failureReason: 'failed to schedule reprocessing',
    });
  });
  it('an ordinary worker finishing after sale cannot publish renditions and records a terminal failure', async () => {
    await db.getRepository(Listing).update(listing.id, { status: 'published' });
    await db.getRepository(ListingMedia).update(media.id, { status: 'processing' });
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#aaa' } })
      .png()
      .toBuffer();
    storage.getBuffer.mockResolvedValue(png as never);
    let reached!: () => void;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      reached = resolve;
    });
    let uploads = 0;
    storage.putBuffer.mockImplementation(async () => {
      if (++uploads === 9) {
        reached();
        await gate;
      }
    });
    const worker = new MediaProcessorWorker(
      db.getRepository(ListingMedia),
      db.getRepository(MediaRendition),
      storage as never,
    );
    const pending = worker.process({ data: { mediaId: media.id } } as never);
    await ready;
    await db.getRepository(Listing).update(listing.id, { status: 'sold' });
    release();
    await pending;
    expect(await db.getRepository(MediaRendition).countBy({ mediaId: media.id })).toBe(0);
    expect(await db.getRepository(ListingMedia).findOneByOrFail({ id: media.id })).toMatchObject({
      status: 'failed',
    });
    expect(storage.delete).toHaveBeenCalledTimes(9);
  });
  it('a source failure after sale records terminal failure without publishing renditions', async () => {
    await db.getRepository(Listing).update(listing.id, { status: 'published' });
    await db
      .getRepository(ListingMedia)
      .update(media.id, { status: 'processing', failureReason: null });
    let reached!: () => void;
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      reached = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    storage.getBuffer.mockImplementationOnce(async () => {
      reached();
      await gate;
      throw new Error('fixture source unavailable');
    });
    const worker = new MediaProcessorWorker(
      db.getRepository(ListingMedia),
      db.getRepository(MediaRendition),
      storage as never,
    );
    const pending = worker.process({ data: { mediaId: media.id } } as never);
    const rejected = expect(pending).rejects.toThrow('fixture source unavailable');
    await ready;
    await db.getRepository(Listing).update(listing.id, { status: 'sold' });
    release();
    await rejected;
    expect(await db.getRepository(ListingMedia).findOneByOrFail({ id: media.id })).toMatchObject({
      status: 'failed',
    });
    expect(await db.getRepository(MediaRendition).countBy({ mediaId: media.id })).toBe(0);
  });
});
