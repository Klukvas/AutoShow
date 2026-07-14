import { ViewsFlushWorker } from './views-flush.worker';

describe('ViewsFlushWorker', () => {
  it('restores drained deltas when the database transaction fails', async () => {
    const updates = [{ listingId: 'l1', delta: 3 }];
    const counter = {
      drain: jest.fn().mockResolvedValue(updates),
      restore: jest.fn().mockResolvedValue(undefined),
    };
    const ds = {
      transaction: jest.fn().mockRejectedValue(new Error('database unavailable')),
    };
    const worker = new ViewsFlushWorker(
      counter as never,
      ds as never,
      {} as never,
      { VIEW_FLUSH_INTERVAL_SECONDS: 60 } as never,
    );

    await expect(worker.process({} as never)).rejects.toThrow('database unavailable');
    expect(counter.restore).toHaveBeenCalledWith(updates);
  });
});
