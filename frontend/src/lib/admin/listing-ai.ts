import { adminCall } from './admin-call';
import type { PhotoAiAccessMode } from './photo-ai';

export type ListingAiBrandVoice = { tone: string; bannedWords: string[]; example: string };
export type ListingAiSettings = {
  enabled: boolean;
  accessMode: PhotoAiAccessMode;
  selectedEditorIds: string[];
  revision: number;
  /** A usable AI key exists (saved in the photo AI settings). */
  keyUsable: boolean;
  /** own_key: the owner saves the key; managed: the platform provides it. */
  keyMode: 'own_key' | 'managed';
  available: boolean;
  brandVoice: ListingAiBrandVoice;
};
export type UpdateListingAiSettings = {
  expectedRevision: number;
  enabled?: boolean;
  accessMode?: PhotoAiAccessMode;
  selectedEditorIds?: string[];
  brandTone?: string;
  brandBannedWords?: string[];
  brandExample?: string;
};

export const BRAND_TONE_MAX = 500;
export const BRAND_EXAMPLE_MAX = 2000;
export const BANNED_WORDS_MAX = 50;
export const BANNED_WORD_MAX_LENGTH = 40;

/** "ідеальний, як новий,, ідеальний" → ["ідеальний", "як новий"]: trimmed, unique, non-empty. */
export function parseBannedWords(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(/[,\n]/)
    .map((word) => word.trim().replace(/\s+/g, ' '))
    .filter((word) => {
      const key = word.toLowerCase();
      if (!word || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Ukrainian reason the banned-word list cannot be saved, or null when it can. */
export function bannedWordsProblem(words: readonly string[]): string | null {
  if (words.length > BANNED_WORDS_MAX) return `Не більше ${BANNED_WORDS_MAX} слів.`;
  const tooLong = words.find((word) => word.length > BANNED_WORD_MAX_LENGTH);
  if (tooLong) return `«${tooLong.slice(0, 20)}…» довше за ${BANNED_WORD_MAX_LENGTH} символів.`;
  const odd = words.find((word) => !/^[\p{L}\d][\p{L}\d '’ʼ-]*$/u.test(word));
  if (odd) return `«${odd}»: лише літери, цифри, пробіли, апостроф і дефіс.`;
  return null;
}

export const listingAiSettingsApi = {
  get: () => adminCall<ListingAiSettings>('/admin/listing-ai/settings'),
  update: (body: UpdateListingAiSettings) =>
    adminCall<ListingAiSettings>('/admin/listing-ai/settings', body, 'PATCH'),
};

/* ---------------- drafts ---------------- */

export type ListingAiPreset = 'short' | 'standard' | 'detailed';
export type ListingAiField = 'description' | 'metaTitle' | 'metaDescription';
export type ListingAiFlagReason =
  | 'unknown_field'
  | 'mismatch'
  | 'unsupported'
  | 'forbidden_content'
  | 'missing_disclosure'
  | 'too_long';
export type ListingAiFlag = {
  reason: ListingAiFlagReason;
  claim: string;
  sourceField: string | null;
  /** Null: the flag concerns the whole draft. */
  field: ListingAiField | null;
};
export type ListingAiDraft = {
  id: string;
  preset: ListingAiPreset;
  status: 'queued' | 'processing' | 'ready' | 'failed' | 'interrupted';
  failureReason: string | null;
  createdAt: string;
  result: Record<ListingAiField, string> | null;
  flags: ListingAiFlag[];
  acceptedAt: string | null;
  acceptedFields: ListingAiField[] | null;
  /** Null when not computed (create and poll responses). */
  isStale: boolean | null;
};
export type ListingAiWorkspace =
  | { permitted: false; reason: string }
  | {
      permitted: true;
      available: boolean;
      reason: string | null;
      drafts: ListingAiDraft[];
      accepted: Record<ListingAiField, ListingAiDraft | null>;
    };

export const LISTING_AI_FIELDS: readonly ListingAiField[] = [
  'description',
  'metaTitle',
  'metaDescription',
];
export const LISTING_AI_PRESETS: readonly ListingAiPreset[] = ['short', 'standard', 'detailed'];

const draftsPath = (listingId: string) => `/admin/listings/${listingId}/ai-description`;
export const listingAiApi = {
  workspace: (listingId: string) => adminCall<ListingAiWorkspace>(draftsPath(listingId)),
  create: (listingId: string, body: { requestId: string; preset: ListingAiPreset }) =>
    adminCall<ListingAiDraft>(draftsPath(listingId), body),
  draft: (listingId: string, id: string) =>
    adminCall<ListingAiDraft>(`${draftsPath(listingId)}/${id}`),
  accept: (
    listingId: string,
    id: string,
    body: { fields: ListingAiField[]; confirmFlags: boolean },
  ) =>
    adminCall<Partial<Record<ListingAiField, string>>>(
      `${draftsPath(listingId)}/${id}/accept`,
      body,
    ),
};

export const isDraftRunning = (draft: Pick<ListingAiDraft, 'status'>) =>
  draft.status === 'queued' || draft.status === 'processing';

/** Flags the owner must confirm before taking these fields (null field = whole draft). */
export function relevantFlags(
  draft: Pick<ListingAiDraft, 'flags'>,
  fields: readonly ListingAiField[],
): ListingAiFlag[] {
  return draft.flags.filter((flag) => flag.field === null || fields.includes(flag.field));
}

export type DraftAttempt = { requestId: string; preset: ListingAiPreset };
/**
 * A retry after an unknown outcome (network error) must reuse the request id,
 * so the server answers with the draft it may already have paid for.
 */
export function draftAttempt(
  previous: DraftAttempt | null,
  preset: ListingAiPreset,
  createId: () => string = () => crypto.randomUUID(),
): DraftAttempt {
  return previous?.preset === preset ? previous : { requestId: createId(), preset };
}
