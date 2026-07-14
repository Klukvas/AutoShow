/**
 * Client-side login lockout (handoff 1a): after MAX_ATTEMPTS consecutive
 * failures the form locks for LOCK_SECONDS with a visible countdown. The
 * backend enforces its own account lock and per-minute rate limit — this is
 * the UX layer that tells the user WHY the button is disabled.
 *
 * Pure state-transition helpers; persistence (localStorage) stays at the
 * call site so this stays unit-testable.
 */

export const MAX_ATTEMPTS = 5;
export const LOCK_SECONDS = 5 * 60;

export interface LockoutState {
  attempts: number;
  /** Epoch ms until which login is locked; 0 = not locked. */
  lockedUntil: number;
}

export const INITIAL_LOCKOUT: LockoutState = { attempts: 0, lockedUntil: 0 };

export function registerFailure(state: LockoutState, now: number): LockoutState {
  const attempts = state.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    return { attempts: 0, lockedUntil: now + LOCK_SECONDS * 1000 };
  }
  return { ...state, attempts };
}

export function registerRateLimit(state: LockoutState, now: number, seconds = 60): LockoutState {
  // Server-side rate limit (403/429) — lock immediately, shorter window.
  return { ...state, lockedUntil: Math.max(state.lockedUntil, now + seconds * 1000) };
}

export function isLocked(state: LockoutState, now: number): boolean {
  return state.lockedUntil > now;
}

export function remainingSeconds(state: LockoutState, now: number): number {
  return Math.max(0, Math.ceil((state.lockedUntil - now) / 1000));
}

/** m:ss countdown for the lockout banner ("4:59"). */
export function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const STORAGE_KEY = 'autoflow-admin-lockout';

export function readStoredLockout(storage: Pick<Storage, 'getItem'>): LockoutState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_LOCKOUT;
    const parsed = JSON.parse(raw) as Partial<LockoutState>;
    return {
      attempts: typeof parsed.attempts === 'number' ? parsed.attempts : 0,
      lockedUntil: typeof parsed.lockedUntil === 'number' ? parsed.lockedUntil : 0,
    };
  } catch {
    return INITIAL_LOCKOUT;
  }
}

export function writeStoredLockout(
  storage: Pick<Storage, 'setItem'>,
  state: LockoutState,
): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode etc. — lockout still applies for the in-memory session.
  }
}
