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
