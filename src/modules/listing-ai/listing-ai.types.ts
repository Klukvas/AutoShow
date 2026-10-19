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

export type ListingAiFlagReason =
  /** The model cited a field that does not exist. */
  | 'unknown_field'
  /** The cited value differs from the listing. */
  | 'mismatch'
  /** A claim in the text has no backing in the listing data. */
  | 'unsupported'
  /** Price, contacts, VIN or a brand-banned word in the text. */
  | 'forbidden_content'
  /** An accident, customs or damage fact the text must state but does not. */
  | 'missing_disclosure'
  /** Longer than the preset or SEO target allows. */
  | 'too_long';

/** Something the owner must confirm or fix before the draft can be accepted. */
export type ListingAiFlag = {
  reason: ListingAiFlagReason;
  /** The words in question as written by the model, or a short explanation (too_long). */
  claim: string;
  sourceField: string | null;
  /** Which generated text it was found in, when known. */
  field: ListingAiField | null;
};
export type ListingAiValidation = { flags: ListingAiFlag[] };
