import type { Make } from './entities/make.entity';
import { MakeLogoService } from './make-logo.service';

function buildService(make: Partial<Make> | null) {
  const makesRepo = {
    findOne: jest.fn(async () => make),
    update: jest.fn(async () => undefined),
    createQueryBuilder: jest.fn(),
  };
  const icons = {
    fetchIcon: jest.fn(async () => ({ buffer: Buffer.from('png'), contentType: 'image/png' })),
  };
  const storage = { putBuffer: jest.fn(async () => undefined) };
  const catalog = { invalidate: jest.fn(async () => undefined) };
  const svc = new MakeLogoService(
    makesRepo as never,
    icons as never,
    storage as never,
    catalog as never,
  );
  return { svc, makesRepo, icons, storage, catalog };
}

const MAKE: Partial<Make> = {
  id: 'make-1',
  slug: 'mercedes-benz',
  nameUk: 'Мерседес-Бенц',
  nameEn: 'Mercedes-Benz',
  logoS3Key: null,
  deletedAt: null,
};

describe('MakeLogoService.fetchLogo', () => {
  it('stores the rendered icon in S3 and stamps the make', async () => {
    const { svc, makesRepo, icons, storage, catalog } = buildService(MAKE);
    await svc.fetchLogo('make-1');
    expect(icons.fetchIcon).toHaveBeenCalledWith('mercedes-benz', 'Mercedes-Benz');
    expect(storage.putBuffer).toHaveBeenCalledWith(
      'catalog/makes/mercedes-benz.png',
      expect.any(Buffer),
      'image/png',
    );
    expect(makesRepo.update).toHaveBeenCalledWith(
      { id: 'make-1' },
      expect.objectContaining({ logoS3Key: 'catalog/makes/mercedes-benz.png' }),
    );
    // Cached /catalog/makes must reflect the new icon immediately.
    expect(catalog.invalidate).toHaveBeenCalled();
  });

  it('stamps the attempt (no key, no cache bust) when the glyph is missing', async () => {
    const { svc, icons, makesRepo, storage, catalog } = buildService(MAKE);
    icons.fetchIcon.mockResolvedValue(null as never);
    await svc.fetchLogo('make-1');
    expect(storage.putBuffer).not.toHaveBeenCalled();
    expect(makesRepo.update).toHaveBeenCalledWith(
      { id: 'make-1' },
      expect.objectContaining({ logoS3Key: null, logoCheckedAt: expect.any(Date) }),
    );
    expect(catalog.invalidate).not.toHaveBeenCalled();
  });

  it('skips makes that already have an icon and tolerates repo errors', async () => {
    const done = buildService({ ...MAKE, logoS3Key: 'catalog/makes/mercedes-benz.png' });
    await done.svc.fetchLogo('make-1');
    expect(done.icons.fetchIcon).not.toHaveBeenCalled();
    expect(done.makesRepo.update).not.toHaveBeenCalled();

    const broken = buildService(MAKE);
    broken.makesRepo.findOne.mockRejectedValueOnce(new Error('db down') as never);
    await expect(broken.svc.fetchLogo('make-1')).resolves.toBeUndefined();
  });
});

describe('SimpleIconsClient slug candidates', () => {
  // The candidate builder is private; verified indirectly through the CDN
  // contract documented there — kept here as a regression fixture.
  it.each([
    ['mercedes-benz', 'Mercedes-Benz', ['mercedesbenz', 'mercedes']],
    ['alfa-romeo', 'Alfa Romeo', ['alfaromeo', 'alfa']],
    ['bmw', 'BMW', ['bmw']],
  ])('%s → %j', async (slug, nameEn, expected) => {
    const { SimpleIconsClient } = await import('./simple-icons.client');
    const client = new SimpleIconsClient();
    const candidates = (
      client as unknown as { slugCandidates: (s: string, n: string | null) => string[] }
    ).slugCandidates(slug, nameEn);
    expect(candidates).toEqual(expected);
  });
});
