import type { AdminPlacementPackage } from '../api/admin';
import { PLACEMENT_CHANNELS, type PlacementChannel } from '../api/types';

/** Mirrors the backend DTO limits so the dialog blocks what the API would 400. */
export const PACKAGE_LIMITS = {
  titleMin: 2,
  titleMax: 80,
  descriptionMax: 500,
  priceMax: 1_000_000,
  featuresMax: 8,
  featureMax: 120,
} as const;

/** Form state of the add/edit dialog; text inputs stay strings until saved. */
export interface PackageDraft {
  id: string | null;
  title: string;
  description: string;
  priceUah: string;
  channels: PlacementChannel[];
  /** One "what's included" bullet per line. */
  featuresText: string;
  isFeatured: boolean;
  position: number;
}

export const EMPTY_PACKAGE_DRAFT: PackageDraft = {
  id: null,
  title: '',
  description: '',
  priceUah: '',
  channels: [],
  featuresText: '',
  isFeatured: false,
  position: 0,
};

export function toPackageDraft(pkg: AdminPlacementPackage): PackageDraft {
  return {
    id: pkg.id,
    title: pkg.title,
    description: pkg.description ?? '',
    priceUah: String(pkg.priceUah),
    channels: pkg.channels,
    featuresText: pkg.features.join('\n'),
    isFeatured: pkg.isFeatured,
    position: pkg.position,
  };
}

export function draftFeatures(draft: PackageDraft): string[] {
  return draft.featuresText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Toggles a channel, keeping the canonical order so cards read consistently. */
export function toggleChannel(
  channels: readonly PlacementChannel[],
  channel: PlacementChannel,
): PlacementChannel[] {
  const next = channels.includes(channel)
    ? channels.filter((c) => c !== channel)
    : [...channels, channel];
  return PLACEMENT_CHANNELS.filter((c) => next.includes(c));
}

function parsePrice(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const price = Number(trimmed);
  return price <= PACKAGE_LIMITS.priceMax ? price : null;
}

export function isPackageDraftValid(draft: PackageDraft): boolean {
  const title = draft.title.trim();
  const features = draftFeatures(draft);
  return (
    title.length >= PACKAGE_LIMITS.titleMin &&
    title.length <= PACKAGE_LIMITS.titleMax &&
    draft.description.trim().length <= PACKAGE_LIMITS.descriptionMax &&
    parsePrice(draft.priceUah) !== null &&
    features.length <= PACKAGE_LIMITS.featuresMax &&
    features.every((feature) => feature.length <= PACKAGE_LIMITS.featureMax)
  );
}

/** Request body for create/update. Call only on a draft that passed validation. */
export function packageDraftToBody(draft: PackageDraft) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    priceUah: parsePrice(draft.priceUah) ?? 0,
    channels: draft.channels,
    features: draftFeatures(draft),
    isFeatured: draft.isFeatured,
    position: draft.position,
  };
}
