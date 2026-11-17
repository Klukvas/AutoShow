const MIN_PLACEHOLDERS = 3;
const MAX_PLACEHOLDERS = 6;

/**
 * Placeholder cards of the three-column favorites grid while the saved cars load: one
 * per saved car, within a range that neither looks broken nor fills the screen.
 */
export function placeholderCount(savedCount: number): number {
  return Math.min(Math.max(savedCount, MIN_PLACEHOLDERS), MAX_PLACEHOLDERS);
}
