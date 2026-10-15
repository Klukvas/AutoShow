import sharp from 'sharp';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CatalogLogoService, MAX_LOGO_BYTES, normalizeLogo } from './catalog-logo.service';
import { MakeLogoService } from './make-logo.service';
import type { Make } from './entities/make.entity';

const actor = { id: 'editor', role: 'editor' } as AuthenticatedUser;
const id = '6ab01d93-44d8-432c-834a-79c082e278ea';
const png = () =>
  sharp({ create: { width: 20, height: 10, channels: 4, background: '#ff660080' } })
    .png()
    .toBuffer();
const file = (buffer: Buffer, mimetype = 'image/png') => ({
  buffer,
  mimetype,
  size: buffer.length,
});
function fixture() {
  let make = {
    id,
    version: 1,
    slug: 'test',
    nameUk: 'Test',
    nameEn: null,
    deletedAt: null,
    logoS3Key: null,
    logoMode: 'auto',
  } as Make;
  const repo = {
    findOne: jest.fn(async () => ({ ...make })),
    update: jest.fn(async (where: Record<string, unknown>, patch: Record<string, unknown>) => {
      if (
        where.version !== make.version ||
        make.deletedAt ||
        (where.logoMode && where.logoMode !== make.logoMode)
      )
        return { affected: 0 };
      make = { ...make, ...patch, version: make.version + 1 };
      return { affected: 1 };
    }),
  };
  const storage = {
    putBuffer: jest.fn(async () => undefined),
    delete: jest.fn(async () => undefined),
    publicUrlFor: (key: string) => `https://media.example/${key}`,
  };
  const catalog = { invalidate: jest.fn(async () => undefined) };
  const audit = { record: jest.fn(async () => undefined) };
  const icons = {
    fetchIcon: jest.fn(async () => ({ buffer: await png(), contentType: 'image/png' as const })),
  };
  return {
    logos: new CatalogLogoService(
      repo as never,
      storage as never,
      catalog as never,
      audit as never,
    ),
    auto: new MakeLogoService(repo as never, icons as never, storage as never, catalog as never),
    repo,
    storage,
    catalog,
    icons,
    current: () => make,
  };
}

describe('catalog logo normalization', () => {
  it('checks decoded type and produces a metadata-free transparent PNG', async () => {
    const output = await normalizeLogo(file(await png()));
    const metadata = await sharp(output).metadata();
    expect(metadata).toMatchObject({ format: 'png', width: 20, height: 10, hasAlpha: true });
    expect(metadata.exif).toBeUndefined();
    await expect(normalizeLogo(file(await png(), 'image/jpeg'))).rejects.toThrow(
      'Файл пошкоджений',
    );
  });
  it('rejects missing, forged, oversized, SVG and oversized pixel data', async () => {
    await expect(normalizeLogo(undefined)).rejects.toThrow('Оберіть');
    await expect(normalizeLogo(file(Buffer.from('not an image')))).rejects.toThrow(
      'Файл пошкоджений',
    );
    await expect(normalizeLogo(file(Buffer.alloc(MAX_LOGO_BYTES + 1)))).rejects.toThrow('Оберіть');
    await expect(
      normalizeLogo(
        file(
          Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'),
          'image/svg+xml',
        ),
      ),
    ).rejects.toThrow('Файл пошкоджений');
    const large = await sharp({
      create: { width: 4001, height: 4000, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer();
    await expect(normalizeLogo(file(large))).rejects.toThrow('Файл пошкоджений');
  });
});

describe('animated and truncated image rejection', () => {
  it('rejects animated WebP/GIF and APNG control chunks', async () => {
    const gif = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAAKAAAALAAAAAABAAEAAAICRAEAIfkEAAoAAAAsAAAAAAEAAQAAAgJMAQA7',
      'base64',
    );
    const webp = await sharp(gif, { animated: true }).webp().toBuffer();
    expect((await sharp(webp, { animated: true }).metadata()).pages).toBe(2);
    await expect(normalizeLogo(file(webp, 'image/webp'))).rejects.toThrow('Файл пошкоджений');
    await expect(normalizeLogo(file(gif, 'image/gif'))).rejects.toThrow('Файл пошкоджений');
    const still = await png();
    const animationChunk = Buffer.alloc(20);
    animationChunk.writeUInt32BE(8, 0);
    animationChunk.write('acTL', 4);
    const apng = Buffer.concat([still.subarray(0, 33), animationChunk, still.subarray(33)]);
    await expect(normalizeLogo(file(apng))).rejects.toThrow('Файл пошкоджений');
    await expect(normalizeLogo(file(still.subarray(0, still.length - 20)))).rejects.toThrow(
      'Файл пошкоджений',
    );
  });
});

describe('manual logos and automatic fetch races', () => {
  it.each(['upload', 'remove'] as const)(
    'manual %s wins while automatic icon fetch is in flight',
    async (action) => {
      const f = fixture();
      let resolveIcon: (value: { buffer: Buffer; contentType: 'image/png' }) => void = () =>
        undefined;
      let started: () => void = () => undefined;
      const startedPromise = new Promise<void>((resolve) => {
        started = resolve;
      });
      f.icons.fetchIcon.mockImplementationOnce(() => {
        started();
        return new Promise((resolve) => {
          resolveIcon = resolve;
        });
      });
      const automatic = f.auto.fetchLogo(id);
      await startedPromise;
      if (action === 'upload') await f.logos.upload(id, file(await png()), actor);
      else await f.logos.remove(id, actor);
      const manualKey = f.current().logoS3Key;
      resolveIcon({ buffer: await png(), contentType: 'image/png' });
      await automatic;
      expect(f.current().logoS3Key).toBe(manualKey);
      expect(f.current().logoMode).toBe(action === 'upload' ? 'manual' : 'none');
      expect(f.storage.delete).toHaveBeenCalledTimes(1);
      await f.auto.fetchLogo(id);
      expect(f.icons.fetchIcon).toHaveBeenCalledTimes(1);
    },
  );
  it('an automatic miss cannot clear a concurrently uploaded logo', async () => {
    const f = fixture();
    f.icons.fetchIcon.mockImplementationOnce(async () => {
      await f.logos.upload(id, file(await png()), actor);
      return null as never;
    });
    await f.auto.fetchLogo(id);
    expect(f.current().logoMode).toBe('manual');
    expect(f.current().logoS3Key).toBeTruthy();
  });
  it('replacement uses a unique key; upload failure preserves the previous logo', async () => {
    const f = fixture();
    await f.logos.upload(id, file(await png()), actor);
    const original = f.current().logoS3Key;
    f.storage.putBuffer.mockRejectedValueOnce(new Error('offline') as never);
    await expect(f.logos.upload(id, file(await png()), actor)).rejects.toThrow('Спробуйте ще раз');
    expect(f.current().logoS3Key).toBe(original);
    await f.logos.upload(id, file(await png()), actor);
    expect(f.current().logoS3Key).not.toBe(original);
    expect(f.storage.delete).toHaveBeenCalledWith(original);
  });
  it('manual remove wins against an in-flight replacement and loser cleans its object', async () => {
    const f = fixture();
    f.storage.putBuffer.mockImplementationOnce(async () => {
      await f.logos.remove(id, actor);
    });
    await expect(f.logos.upload(id, file(await png()), actor)).rejects.toThrow('Марку вже змінено');
    expect(f.current().logoMode).toBe('none');
    expect(f.current().logoS3Key).toBeNull();
    expect(f.storage.delete).toHaveBeenCalledTimes(1);
  });
  it('cleanup failure leaves the successful persisted replacement intact', async () => {
    const f = fixture();
    await f.logos.upload(id, file(await png()), actor);
    f.storage.delete.mockRejectedValueOnce(new Error('cleanup offline') as never);
    await expect(f.logos.remove(id, actor)).resolves.toEqual({ logoUrl: null });
    expect(f.current().logoMode).toBe('none');
  });
  it('rejects a deleted or unknown make before storage', async () => {
    const f = fixture();
    f.repo.findOne.mockResolvedValueOnce(null as never);
    await expect(f.logos.upload(id, file(await png()), actor)).rejects.toThrow('Марку не знайдено');
    expect(f.storage.putBuffer).not.toHaveBeenCalled();
  });
});
