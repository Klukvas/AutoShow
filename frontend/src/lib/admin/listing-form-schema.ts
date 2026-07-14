import { z } from 'zod';

/**
 * Client-side mirror of the backend CreateListingDto constraints. Errors carry
 * i18n KEYS (+ params) — copy lives in messages/*.json, never here.
 */

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;
export const YEAR_MIN = 1900;
export const YEAR_MAX = 2100;

export interface FieldIssue {
  key: string;
  params?: Record<string, string | number>;
}

const required = { key: 'vRequired' } as const;

const idField = z.string().min(1);
const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: JSON.stringify({ key: 'vMaxLength', params: { max } }) })
    .optional()
    .or(z.literal(''));

function issue(key: string, params?: Record<string, string | number>): string {
  return JSON.stringify({ key, params });
}

/** Empty inputs (untouched number fields) parse as "not provided". */
function emptyAsUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((v) => (v === '' || v == null ? undefined : v), schema.optional());
}

export const listingFormSchema = z.object({
  makeId: idField,
  modelId: idField,
  year: z.coerce
    .number({ invalid_type_error: issue('vRequired') })
    .int()
    .min(YEAR_MIN, { message: issue('vYear', { min: YEAR_MIN, max: YEAR_MAX }) })
    .max(YEAR_MAX, { message: issue('vYear', { min: YEAR_MIN, max: YEAR_MAX }) }),
  generation: optionalTrimmed(64),
  modification: optionalTrimmed(128),
  vin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(VIN_REGEX, { message: issue('vVin') })
    .optional()
    .or(z.literal('')),
  vinVisible: z.boolean(),
  mileageKm: z.coerce
    .number({ invalid_type_error: issue('vNonNegative') })
    .int({ message: issue('vNonNegative') })
    .min(0, { message: issue('vNonNegative') }),
  bodyTypeId: idField,
  fuelTypeId: idField,
  transmissionId: idField,
  driveTypeId: idField,
  colorId: idField,
  engineVolumeL: z.coerce
    .number({ invalid_type_error: issue('vPositive') })
    .min(0.1, { message: issue('vPositive') })
    .max(99.9, { message: issue('vPositive') }),
  powerHp: z.coerce
    .number({ invalid_type_error: issue('vPositive') })
    .int({ message: issue('vPositive') })
    .min(1, { message: issue('vPositive') })
    .max(2500, { message: issue('vPositive') }),
  condition: z.enum(['new', 'used', 'damaged']),
  ownersCount: z.coerce
    .number({ invalid_type_error: issue('vNonNegative') })
    .int({ message: issue('vNonNegative') })
    .min(0, { message: issue('vNonNegative') })
    .max(30, { message: issue('vNonNegative') }),
  isCrashed: z.boolean(),
  customsCleared: z.boolean(),
  priceAmount: z.coerce
    .number({ invalid_type_error: issue('vPositive') })
    .min(1, { message: issue('vPositive') }),
  priceCurrency: z.enum(['USD', 'EUR', 'UAH']),
  isNegotiable: z.boolean(),
  title: z
    .string()
    .trim()
    .min(8, { message: issue('vMinLength', { min: 8 }) })
    .max(255, { message: issue('vMaxLength', { max: 255 }) }),
  description: z
    .string()
    .trim()
    .min(20, { message: issue('vMinLength', { min: 20 }) })
    .max(10000, { message: issue('vMaxLength', { max: 10000 }) }),
  locationCity: z
    .string()
    .trim()
    .min(2, { message: issue('vMinLength', { min: 2 }) })
    .max(128, { message: issue('vMaxLength', { max: 128 }) }),
  optionIds: z.array(z.string()),
  // Consignment economics
  sellerType: z.enum(['own', 'client']),
  sellerName: optionalTrimmed(128),
  sellerPhone: optionalTrimmed(32),
  feeType: z.enum(['none', 'fixed', 'percent']),
  feePercent: emptyAsUndefined(
    z.coerce
      .number({ invalid_type_error: issue('vPositive') })
      .min(0, { message: issue('vNonNegative') })
      .max(100, { message: issue('vPercentRange') }),
  ),
  feeFixedAmount: emptyAsUndefined(
    z.coerce
      .number({ invalid_type_error: issue('vPositive') })
      .min(0, { message: issue('vNonNegative') }),
  ),
});

/** The fee rate matching the chosen fee type must actually be filled in. */
export const listingFormSchemaWithFees = listingFormSchema.superRefine((values, ctx) => {
  if (values.feeType === 'percent' && (values.feePercent === undefined || values.feePercent <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['feePercent'],
      message: issue('vRequired'),
    });
  }
  if (
    values.feeType === 'fixed' &&
    (values.feeFixedAmount === undefined || values.feeFixedAmount <= 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['feeFixedAmount'],
      message: issue('vRequired'),
    });
  }
});

export type ListingFormValues = z.infer<typeof listingFormSchema>;

export interface ParsedListingForm {
  values?: ListingFormValues;
  /** Field name → i18n issue. */
  errors: Record<string, FieldIssue>;
}

function decodeIssue(message: string): FieldIssue {
  try {
    const parsed = JSON.parse(message) as FieldIssue;
    if (parsed && typeof parsed.key === 'string') return parsed;
  } catch {
    // Non-JSON zod default (e.g. required_error) → generic "required".
  }
  return required;
}

export function parseListingForm(raw: Record<string, unknown>): ParsedListingForm {
  const result = listingFormSchemaWithFees.safeParse(raw);
  if (result.success) return { values: result.data, errors: {} };
  const errors: Record<string, FieldIssue> = {};
  for (const zIssue of result.error.issues) {
    const field = String(zIssue.path[0] ?? 'form');
    if (!errors[field]) errors[field] = decodeIssue(zIssue.message);
  }
  return { errors };
}

/** API body from validated values (empty optionals dropped, vin normalized). */
export function listingBodyFromValues(values: ListingFormValues): Record<string, unknown> {
  return {
    makeId: values.makeId,
    modelId: values.modelId,
    year: values.year,
    mileageKm: values.mileageKm,
    generation: values.generation || undefined,
    modification: values.modification || undefined,
    vin: values.vin ? values.vin.toUpperCase() : undefined,
    vinVisible: values.vinVisible,
    bodyTypeId: values.bodyTypeId,
    fuelTypeId: values.fuelTypeId,
    transmissionId: values.transmissionId,
    driveTypeId: values.driveTypeId,
    colorId: values.colorId,
    engineVolumeL: values.engineVolumeL,
    powerHp: values.powerHp,
    condition: values.condition,
    ownersCount: values.ownersCount,
    isCrashed: values.isCrashed,
    customsCleared: values.customsCleared,
    priceAmount: values.priceAmount,
    priceCurrency: values.priceCurrency,
    isNegotiable: values.isNegotiable,
    title: values.title,
    description: values.description,
    locationCity: values.locationCity,
    optionIds: values.optionIds,
    sellerType: values.sellerType,
    sellerName: values.sellerType === 'client' ? values.sellerName || undefined : undefined,
    sellerPhone: values.sellerType === 'client' ? values.sellerPhone || undefined : undefined,
    feeType: values.feeType,
    feePercent: values.feeType === 'percent' ? values.feePercent : undefined,
    feeFixedAmount: values.feeType === 'fixed' ? values.feeFixedAmount : undefined,
  };
}
