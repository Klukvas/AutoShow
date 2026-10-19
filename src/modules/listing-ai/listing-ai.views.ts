import type { ListingAiGeneration } from './entities/listing-ai-generation.entity';
import type {
  ListingAiField,
  ListingAiFlag,
  ListingAiPreset,
  ListingAiResult,
  ListingAiStatus,
} from './listing-ai.types';

/** What the admin UI sees of a draft: no input snapshot, prompt, cost or tokens. */
export type ListingAiDraftView = {
  id: string;
  preset: ListingAiPreset;
  status: ListingAiStatus;
  failureReason: string | null;
  createdAt: Date;
  result: Omit<ListingAiResult, 'facts'> | null;
  flags: ListingAiFlag[];
  acceptedAt: Date | null;
  acceptedFields: ListingAiField[] | null;
  /**
   * The listing data has changed since this draft was made; null when it was
   * not computed (the cheap poll and create responses).
   */
  isStale: boolean | null;
};

export function draftView(
  row: ListingAiGeneration,
  currentInputHash: string | null,
): ListingAiDraftView {
  return {
    id: row.id,
    preset: row.preset,
    status: row.status,
    failureReason: row.failureReason,
    createdAt: row.createdAt,
    result: row.result
      ? {
          description: row.result.description,
          metaTitle: row.result.metaTitle,
          metaDescription: row.result.metaDescription,
        }
      : null,
    flags: row.validation?.flags ?? [],
    acceptedAt: row.acceptedAt,
    acceptedFields: row.acceptedFields,
    isStale: currentInputHash === null ? null : row.inputHash !== currentInputHash,
  };
}
