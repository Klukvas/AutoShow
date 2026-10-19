/**
 * Channels a placement package can include. A fixed set so the storefront
 * labels them the same way on every card; anything else the salon offers
 * (a photo shoot, a repost) goes into the package's free-text features.
 */
export const PLACEMENT_CHANNELS = [
  'site',
  'instagram_post',
  'instagram_story',
  'telegram',
  'tiktok',
] as const;

export type PlacementChannel = (typeof PLACEMENT_CHANNELS)[number];

export const MAX_PACKAGE_FEATURES = 8;
export const MAX_PACKAGE_PRICE_UAH = 1_000_000;
