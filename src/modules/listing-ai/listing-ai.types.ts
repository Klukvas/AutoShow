/** Length/detail preset the owner picks before generating. */
export const LISTING_AI_PRESETS = ['short', 'standard', 'detailed'] as const;
export type ListingAiPreset = (typeof LISTING_AI_PRESETS)[number];

export const LISTING_AI_STATUSES = [
  'queued',
  'processing',
  'ready',
  'failed',
  'interrupted',
] as const;
export type ListingAiStatus = (typeof LISTING_AI_STATUSES)[number];

/** Who may generate descriptions; admins always may. */
export const LISTING_AI_ACCESS_MODES = ['admins', 'all', 'selected'] as const;
export type ListingAiAccessMode = (typeof LISTING_AI_ACCESS_MODES)[number];

/** Listing fields a generated draft can fill. */
export const LISTING_AI_FIELDS = ['description', 'metaTitle', 'metaDescription'] as const;
export type ListingAiField = (typeof LISTING_AI_FIELDS)[number];

/** A fact the model says it used, with the listing field it came from. */
export type ListingAiFact = { claim: string; sourceField: string; value: string };

export type ListingAiResult = {
  description: string;
  metaTitle: string;
  metaDescription: string;
  facts: ListingAiFact[];
};

/** A fact the server could not confirm against the listing. */
export type ListingAiFlag = {
  claim: string;
  sourceField: string;
  reason: 'unknown_field' | 'mismatch' | 'unsupported';
};
export type ListingAiValidation = { flags: ListingAiFlag[] };
