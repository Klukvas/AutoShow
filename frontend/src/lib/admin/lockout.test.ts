import { describe, expect, it } from 'vitest';
import {
  INITIAL_LOCKOUT,
  LOCK_SECONDS,
  MAX_ATTEMPTS,
  formatCountdown,
  isLocked,
  readStoredLockout,
  registerFailure,
  registerRateLimit,
  remainingSeconds,
} from './lockout';

const NOW = 1_700_000_000_000;

describe('login lockout', () => {
  it('locks after MAX_ATTEMPTS consecutive failures', () => {
    let state = INITIAL_LOCKOUT;
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      state = registerFailure(state, NOW);
      expect(isLocked(state, NOW)).toBe(false);
    }
    state = registerFailure(state, NOW);
    expect(isLocked(state, NOW)).toBe(true);
    expect(remainingSeconds(state, NOW)).toBe(LOCK_SECONDS);
  });

  it('resets the attempt counter when the lock engages', () => {
    let state = INITIAL_LOCKOUT;
    for (let i = 0; i < MAX_ATTEMPTS; i++) state = registerFailure(state, NOW);
    expect(state.attempts).toBe(0);
  });

  it('unlocks after the window passes', () => {
    let state = INITIAL_LOCKOUT;
    for (let i = 0; i < MAX_ATTEMPTS; i++) state = registerFailure(state, NOW);
    expect(isLocked(state, NOW + LOCK_SECONDS * 1000 + 1)).toBe(false);
  });

  it('rate-limit lock never shortens an existing lock', () => {
    let state = INITIAL_LOCKOUT;
    for (let i = 0; i < MAX_ATTEMPTS; i++) state = registerFailure(state, NOW);
    const rateLimited = registerRateLimit(state, NOW, 60);
    expect(rateLimited.lockedUntil).toBe(state.lockedUntil);
  });

  it('rate-limit lock applies its own window when unlocked', () => {
    const state = registerRateLimit(INITIAL_LOCKOUT, NOW, 60);
    expect(isLocked(state, NOW)).toBe(true);
    expect(remainingSeconds(state, NOW)).toBe(60);
  });

  it('formats the countdown as m:ss', () => {
    expect(formatCountdown(299)).toBe('4:59');
    expect(formatCountdown(60)).toBe('1:00');
    expect(formatCountdown(5)).toBe('0:05');
    expect(formatCountdown(0)).toBe('0:00');
  });

  it('reads garbage storage safely', () => {
    expect(readStoredLockout({ getItem: () => 'not-json' })).toEqual(INITIAL_LOCKOUT);
    expect(readStoredLockout({ getItem: () => null })).toEqual(INITIAL_LOCKOUT);
    expect(
      readStoredLockout({ getItem: () => JSON.stringify({ attempts: 2, lockedUntil: 5 }) }),
    ).toEqual({ attempts: 2, lockedUntil: 5 });
  });
});
