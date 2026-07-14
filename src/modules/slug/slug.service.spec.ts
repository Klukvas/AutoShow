import { SlugService } from './slug.service';

describe('SlugService', () => {
  const service = new SlugService();

  it('creates stable ASCII slugs without an ESM-only runtime dependency', () => {
    expect(service.toSlug('BMW X5 2025')).toBe('bmw-x5-2025');
    expect(service.toSlug('  Audi---A6  ')).toBe('audi-a6');
  });
});
