export const DURATION = 5;
export const CRUISE_END = 1.8;
export const STOP_TIME = 2.5;
export const SPEED = 1.3;
export const BRAKE_DURATION = STOP_TIME - CRUISE_END;
export const TRAVEL = SPEED * (CRUISE_END + BRAKE_DURATION / 2);

export function motionAt(inputTime) {
  const time = Math.max(0, Math.min(DURATION, Number.isFinite(inputTime) ? inputTime : 0));
  if (time >= STOP_TIME) return { time, remaining: 0, travelled: TRAVEL, speed: 0 };
  if (time <= CRUISE_END) return { time, remaining: TRAVEL - SPEED * time, travelled: SPEED * time, speed: SPEED };
  const progress = (time - CRUISE_END) / BRAKE_DURATION;
  const travelled = SPEED * CRUISE_END + SPEED * BRAKE_DURATION * (progress - progress ** 3 + progress ** 4 / 2);
  const speed = SPEED * (1 - 3 * progress ** 2 + 2 * progress ** 3);
  return { time, remaining: Math.max(0, TRAVEL - travelled), travelled: Math.min(TRAVEL, travelled), speed: Math.max(0, speed) };
}
