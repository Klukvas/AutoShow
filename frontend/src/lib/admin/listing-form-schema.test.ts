import { describe, expect, it } from 'vitest';
import { listingBodyFromValues, parseListingForm } from './listing-form-schema';

const VALID: Record<string, unknown> = {
  makeId: 'make-1',
  modelId: 'model-1',
  year: '2022',
  generation: '992',
  modification: 'Carrera S',
  vin: 'WP0ZZZ99ZTS392124',
  vinVisible: true,
  mileageKm: '18200',
  bodyTypeId: 'b-1',
  fuelTypeId: 'f-1',
  transmissionId: 't-1',
  driveTypeId: 'd-1',
  colorId: 'c-1',
  engineVolumeL: '3.0',
  powerHp: '450',
  condition: 'used',
  ownersCount: '1',
  isCrashed: false,
  customsCleared: true,
  priceAmount: '142000',
  priceCurrency: 'USD',
  isNegotiable: true,
  title: 'Porsche 911 Carrera S',
  description: 'Еталонний Carrera S у комплектації Sport Chrono, один власник.',
  locationCity: 'Київ',
  optionIds: ['o-1', 'o-2'],
};

describe('listing form schema', () => {
  it('accepts a valid form and coerces numbers', () => {
    const { values, errors } = parseListingForm(VALID);
    expect(errors).toEqual({});
    expect(values?.year).toBe(2022);
    expect(values?.priceAmount).toBe(142000);
  });

  it('collects one issue per field with i18n keys', () => {
    const { values, errors } = parseListingForm({
      ...VALID,
      makeId: '',
      mileageKm: '-5',
      year: '1800',
      title: 'abc',
    });
    expect(values).toBeUndefined();
    expect(errors.makeId.key).toBe('vRequired');
    expect(errors.mileageKm.key).toBe('vNonNegative');
    expect(errors.year.key).toBe('vYear');
    expect(errors.year.params).toEqual({ min: 1900, max: 2100 });
    expect(errors.title.key).toBe('vMinLength');
  });

  it('rejects malformed VIN but allows empty', () => {
    expect(parseListingForm({ ...VALID, vin: 'bad-vin' }).errors.vin?.key).toBe('vVin');
    expect(parseListingForm({ ...VALID, vin: '' }).errors.vin).toBeUndefined();
  });

  it('builds the API body dropping empty optionals', () => {
    const { values } = parseListingForm({ ...VALID, generation: '', vin: '' });
    const body = listingBodyFromValues(values!);
    expect(body.generation).toBeUndefined();
    expect(body.vin).toBeUndefined();
    expect(body.optionIds).toEqual(['o-1', 'o-2']);
    expect(body.vinVisible).toBe(true);
  });
});
