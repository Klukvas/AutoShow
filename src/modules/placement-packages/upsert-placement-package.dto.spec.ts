import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreatePlacementPackageDto,
  UpdatePlacementPackageDto,
} from './dto/upsert-placement-package.dto';

/** Mirrors the global ValidationPipe (transform + whitelist). */
async function check<T extends object>(cls: new () => T, payload: Record<string, unknown>) {
  const dto = plainToInstance(cls, payload);
  const errors = await validate(dto, { whitelist: true });
  return { dto, fields: errors.map((error) => error.property) };
}

const valid = { title: 'Telegram', priceUah: 200, channels: ['telegram'] };

describe('placement package DTO validation', () => {
  it('accepts a minimal package', async () => {
    const { fields } = await check(CreatePlacementPackageDto, valid);
    expect(fields).toEqual([]);
  });

  it('measures the title after trimming', async () => {
    const { fields } = await check(CreatePlacementPackageDto, { ...valid, title: '  a  ' });
    expect(fields).toEqual(['title']);
  });

  it('rejects a channel outside the fixed list', async () => {
    const { fields } = await check(CreatePlacementPackageDto, { ...valid, channels: ['olx'] });
    expect(fields).toEqual(['channels']);
  });

  it('rejects a negative or fractional price', async () => {
    for (const priceUah of [-1, 99.5]) {
      const { fields } = await check(CreatePlacementPackageDto, { ...valid, priceUah });
      expect(fields).toEqual(['priceUah']);
    }
  });

  it('trims features and drops the blank rows the admin form sends', async () => {
    const { dto, fields } = await check(CreatePlacementPackageDto, {
      ...valid,
      features: ['  Пост у стрічці ', '', '   '],
    });
    expect(fields).toEqual([]);
    expect(dto.features).toEqual(['Пост у стрічці']);
  });

  it('caps the number of features', async () => {
    const features = Array.from({ length: 9 }, (_, index) => `Пункт ${index + 1}`);
    const { fields } = await check(CreatePlacementPackageDto, { ...valid, features });
    expect(fields).toEqual(['features']);
  });

  it('rejects an explicit null on NOT NULL columns in a PATCH', async () => {
    const { fields } = await check(UpdatePlacementPackageDto, {
      title: null,
      priceUah: null,
      channels: null,
    });
    expect(fields.sort()).toEqual(['channels', 'priceUah', 'title']);
  });

  it('lets a PATCH clear the description', async () => {
    const { fields } = await check(UpdatePlacementPackageDto, { description: null });
    expect(fields).toEqual([]);
  });
});
