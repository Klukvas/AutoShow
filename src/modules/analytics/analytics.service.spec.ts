import { AnalyticsService } from './analytics.service';

/** Prototype view exposing the members under test (private on the class). */
interface Svc {
  summary(): Promise<unknown>;
  compute(): Promise<unknown>;
  conversionOf(views: number, leads: number): { views: number; leads: number; rate: number };
  redis: { client: { get: jest.Mock; set: jest.Mock } };
}

function makeService(): Svc {
  return Object.create(AnalyticsService.prototype) as unknown as Svc;
}

describe('AnalyticsService', () => {
  describe('conversionOf', () => {
    it('returns a zero funnel when there are no views', () => {
      expect(makeService().conversionOf(0, 0)).toEqual({ views: 0, leads: 0, rate: 0 });
    });

    it('computes the rate as a percentage rounded to one decimal', () => {
      expect(makeService().conversionOf(1000, 32)).toEqual({ views: 1000, leads: 32, rate: 3.2 });
    });
  });

  describe('summary caching', () => {
    it('returns the cached payload without recomputing on a cache hit', async () => {
      const svc = makeService();
      const cachedPayload = { conversion: { views: 5, leads: 1, rate: 20 } };
      svc.redis = {
        client: {
          get: jest.fn().mockResolvedValue(JSON.stringify(cachedPayload)),
          set: jest.fn(),
        },
      };
      const compute = jest.spyOn(svc, 'compute');
      const result = await svc.summary();
      expect(result).toEqual(cachedPayload);
      expect(compute).not.toHaveBeenCalled();
      expect(svc.redis.client.set).not.toHaveBeenCalled();
    });

    it('recomputes and caches on a miss', async () => {
      const svc = makeService();
      const fresh = { conversion: { views: 10, leads: 2, rate: 20 } };
      svc.redis = {
        client: {
          get: jest.fn().mockResolvedValue(null),
          set: jest.fn().mockResolvedValue('OK'),
        },
      };
      jest.spyOn(svc, 'compute').mockResolvedValue(fresh);
      const result = await svc.summary();
      expect(result).toBe(fresh);
      expect(svc.redis.client.set).toHaveBeenCalledWith(
        'analytics:summary',
        JSON.stringify(fresh),
        'EX',
        60,
      );
    });
  });
});
