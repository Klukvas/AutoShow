export const STREET_RATE = 1.3;
export const STREET_STOP = 2.5;
export const STREET_PUSH = 0;
/** Listings start revealing at this source time, decoupled from the car's stop. */
export const CARD_START = 0;

/** @param {number} time @param {boolean} reducedMotion @returns {number} */
export function streetScale(time, reducedMotion = false) {
  if (reducedMotion) return 1;
  const progress = Math.max(0, Math.min(1, time / STREET_STOP));
  return 1 + STREET_PUSH * progress * progress * (3 - 2 * progress);
}

/** @param {number} time @param {number} index @returns {number} */
export function streetCardProgress(time, index) {
  return clamp(cardSeconds(time, index) / 0.42);
}

/** @param {number} value @returns {number} */
const clamp = value => Math.max(0, Math.min(1, value));
/** @param {number} value @param {number} power @returns {number} */
const easeOut = (value, power = 3) => 1 - (1 - value) ** power;
/** @param {number} time @param {number} index @returns {number} */
const cardSeconds = (time, index) => (time - CARD_START) / STREET_RATE - index * 0.075;

/** @param {number} time @param {number} index @param {boolean} forceVisible */
export function streetCardPose(time, index, forceVisible = false) {
  const seconds = forceVisible ? 0.48 : cardSeconds(time, index);
  const progress = forceVisible ? 1 : streetCardProgress(time, index);
  const arrival = easeOut(progress, 5);
  const photo = easeOut(clamp(seconds / 0.48), 4);
  const opacity = easeOut(clamp(seconds / 0.22));
  return {
    visible: seconds > 0, interactive: progress >= 0.2,
    complete: seconds >= 0.48 - 1e-9,
    opacity, skeletonOpacity: 1 - opacity,
    y: 24 * (1 - arrival), scale: 0.975 + 0.025 * arrival,
    photoScale: 1.04 - 0.04 * photo, photoInset: 10 * (1 - photo),
    text: [0.06, 0.10, 0.14].map(delay => {
      const value = easeOut(clamp((seconds - delay) / 0.26));
      return { opacity: value, y: 6 * (1 - value) };
    })
  };
}
