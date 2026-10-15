import { describe, expect, it, vi } from 'vitest';
import {
  decideLeadWatch,
  isPollDue,
  pollNewLeads,
  LEAD_POLL_INTERVAL_MS,
  type LeadWatchPort,
} from './lead-watch';

describe('decideLeadWatch', () => {
  it('an observation equal to the server baseline is silent', () => {
    expect(decideLeadWatch(3, 3)).toEqual({ baseline: 3, arrived: 0, shouldRefresh: false });
  });

  it('growth reports how many arrived and asks for a refresh', () => {
    expect(decideLeadWatch(0, 2)).toEqual({ baseline: 2, arrived: 2, shouldRefresh: true });
  });

  it('a drop refreshes the stale badge without toasting', () => {
    expect(decideLeadWatch(4, 1)).toEqual({ baseline: 1, arrived: 0, shouldRefresh: true });
  });

  it('inbox emptied → baseline follows down to zero', () => {
    expect(decideLeadWatch(2, 0)).toEqual({ baseline: 0, arrived: 0, shouldRefresh: true });
  });

  it('ignores a malformed counter instead of toasting nonsense', () => {
    for (const bad of [undefined, null, NaN, Infinity, -1, '5', {}]) {
      expect(decideLeadWatch(2, bad)).toEqual({ baseline: 2, arrived: 0, shouldRefresh: false });
    }
  });

  it('clamps a nonsense baseline to zero', () => {
    expect(decideLeadWatch(-3, 1)).toEqual({ baseline: 1, arrived: 1, shouldRefresh: true });
  });
});

function makePort(overrides: Partial<LeadWatchPort> = {}) {
  return {
    getAccessToken: vi.fn(async () => 'token' as string | null),
    countNewLeads: vi.fn(async () => 0 as number | undefined),
    onArrived: vi.fn(),
    onStale: vi.fn(),
    ...overrides,
  };
}

describe('pollNewLeads', () => {
  it('notifies once per batch and refreshes the shell', async () => {
    const port = makePort({ countNewLeads: vi.fn(async () => 3) });

    expect(await pollNewLeads(1, port)).toBe(3);
    expect(port.onArrived).toHaveBeenCalledOnce();
    expect(port.onArrived).toHaveBeenCalledWith(2);
    expect(port.onStale).toHaveBeenCalledOnce();
  });

  it('an unchanged count notifies nothing and refreshes nothing', async () => {
    const port = makePort({ countNewLeads: vi.fn(async () => 2) });

    expect(await pollNewLeads(2, port)).toBe(2);
    expect(port.onArrived).not.toHaveBeenCalled();
    expect(port.onStale).not.toHaveBeenCalled();
  });

  it('a drop refreshes the badge but stays silent', async () => {
    const port = makePort({ countNewLeads: vi.fn(async () => 0) });

    expect(await pollNewLeads(2, port)).toBe(0);
    expect(port.onArrived).not.toHaveBeenCalled();
    expect(port.onStale).toHaveBeenCalledOnce();
  });

  it('an expired session is quiet and does not touch the baseline', async () => {
    const port = makePort({ getAccessToken: vi.fn(async () => null) });

    expect(await pollNewLeads(2, port)).toBe(2);
    expect(port.countNewLeads).not.toHaveBeenCalled();
    expect(port.onArrived).not.toHaveBeenCalled();
    expect(port.onStale).not.toHaveBeenCalled();
  });

  it('a failed request (429, offline) is quiet and does not touch the baseline', async () => {
    const port = makePort({
      countNewLeads: vi.fn(async () => {
        throw new Error('Too Many Requests');
      }),
    });

    await expect(pollNewLeads(2, port)).resolves.toBe(2);
    expect(port.onArrived).not.toHaveBeenCalled();
    expect(port.onStale).not.toHaveBeenCalled();
  });

  it('a missing total falls back without notifying nonsense', async () => {
    const port = makePort({ countNewLeads: vi.fn(async () => undefined) });

    expect(await pollNewLeads(5, port)).toBe(5);
    expect(port.onArrived).not.toHaveBeenCalled();
    expect(port.onStale).not.toHaveBeenCalled();
  });
});

describe('isPollDue', () => {
  it('allows the very first poll', () => {
    expect(isPollDue(null, 1_000)).toBe(true);
  });

  it('blocks a poll inside the interval', () => {
    expect(isPollDue(1_000, 1_000 + LEAD_POLL_INTERVAL_MS - 1)).toBe(false);
  });

  it('allows a poll once the interval elapsed', () => {
    expect(isPollDue(1_000, 1_000 + LEAD_POLL_INTERVAL_MS)).toBe(true);
  });

  it('does not wedge on a backwards clock', () => {
    expect(isPollDue(10_000, 1_000)).toBe(true);
  });
});
