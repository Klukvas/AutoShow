import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateBrandingDto } from './dto/update-branding.dto';

/** Mirrors the global ValidationPipe (transform + whitelist). */
async function check(payload: Record<string, unknown>) {
  const dto = plainToInstance(UpdateBrandingDto, payload);
  const errors = await validate(dto, { whitelist: true });
  return errors;
}

describe('UpdateBrandingDto validation', () => {
  it('rejects a javascript: social link (stored-XSS vector)', async () => {
    const errors = await check({ socialLinks: { instagram: 'javascript:alert(1)' } });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts an https social link', async () => {
    const errors = await check({ socialLinks: { instagram: 'https://instagram.com/dealer' } });
    expect(errors).toHaveLength(0);
  });

  it('treats an empty social link as absent (no error)', async () => {
    const errors = await check({ socialLinks: { instagram: '' } });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-http ogImage', async () => {
    const errors = await check({ seoDefaults: { ogImage: 'data:text/html,x' } });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a malformed contactEmail', async () => {
    const errors = await check({ contactEmail: 'not-an-email' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts a valid contactEmail', async () => {
    const errors = await check({ contactEmail: 'sales@dealer.example' });
    expect(errors).toHaveLength(0);
  });
});
