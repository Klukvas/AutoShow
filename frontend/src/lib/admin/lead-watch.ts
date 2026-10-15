/**
 * Decision logic for the admin new-leads watcher (see
 * `components/admin/leads/lead-live-notifier.tsx`).
 *
 * Kept free of React and the browser so the interesting part — "is this a new
 * lead, a stale badge, or just a failed request?" — is testable without a DOM
 * or a running backend. The component only owns the timer and the refs.
 */

/** Poll cadence while the admin tab is visible. */
export const LEAD_POLL_INTERVAL_MS = 25_000;

export interface LeadWatchDecision {
  /** Count the next observation is compared against. */
  baseline: number;
  /** How many leads appeared since the baseline; 0 when none did. */
  arrived: number;
  /** Server-rendered counts (sidebar badge, inbox list) are behind. */
  shouldRefresh: boolean;
}

/**
 * The counter comes from an API response, so it is treated as untrusted:
 * anything that is not a whole, non-negative number is ignored rather than
 * turned into a nonsense "0 new leads" toast.
 */
function normalizeCount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const whole = Math.trunc(value);
  return whole >= 0 ? whole : null;
}

/**
 * Compare a freshly observed new-leads count against the last known one.
 *
 * Growth is the only toast-worthy event. A drop means someone (another tab,
 * another teammate) already worked the inbox — adopt it quietly, but still
 * refresh so the badge does not keep advertising leads that are gone.
 */
export function decideLeadWatch(baseline: number, observed: unknown): LeadWatchDecision {
  const current = normalizeCount(baseline) ?? 0;
  const next = normalizeCount(observed);

  if (next === null || next === current) {
    return { baseline: current, arrived: 0, shouldRefresh: false };
  }

  return {
    baseline: next,
    arrived: Math.max(0, next - current),
    shouldRefresh: true,
  };
}

/** Everything one poll needs from the browser and the API, injected. */
export interface LeadWatchPort {
  /** Current admin access token, or null once the session is gone. */
  getAccessToken: () => Promise<string | null>;
  /** How many leads are in `new`; undefined when the API omitted the total. */
  countNewLeads: (accessToken: string) => Promise<number | undefined>;
  /** New leads showed up — tell the admin, once per batch. */
  onArrived: (count: number) => void;
  /** The server-rendered counts are stale and need re-fetching. */
  onStale: () => void;
}

/**
 * Run one poll and return the baseline to compare the next one against.
 *
 * Failure is always quiet: an expired session, a 429 or a dropped connection
 * leaves the baseline untouched and notifies nothing — a watcher that shouts
 * about its own plumbing is worse than a slightly stale badge, and the next
 * tick retries anyway.
 */
export async function pollNewLeads(baseline: number, port: LeadWatchPort): Promise<number> {
  let observed: number | undefined;
  try {
    const accessToken = await port.getAccessToken();
    if (!accessToken) return baseline;
    observed = await port.countNewLeads(accessToken);
  } catch {
    return baseline;
  }

  const decision = decideLeadWatch(baseline, observed);
  if (decision.arrived > 0) port.onArrived(decision.arrived);
  if (decision.shouldRefresh) port.onStale();
  return decision.baseline;
}

/**
 * Throttle for polls triggered by something other than the timer (a tab
 * regaining focus), so flipping between tabs cannot turn into a request loop.
 */
export function isPollDue(
  lastPollAt: number | null,
  now: number,
  minIntervalMs: number = LEAD_POLL_INTERVAL_MS,
): boolean {
  if (lastPollAt === null) return true;
  const elapsed = now - lastPollAt;
  // A backwards clock (NTP correction, sleep/wake) must not wedge the watcher.
  if (!Number.isFinite(elapsed) || elapsed < 0) return true;
  return elapsed >= minIntervalMs;
}
