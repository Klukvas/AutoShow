import type { CreateLeadDto } from './dto/create-lead.dto';
import { LeadsService } from './leads.service';

/**
 * A sell_request can carry the placement package picked on the homepage. The
 * lead keeps a snapshot of its title and price, and a package that went away
 * mid-form must never cost the salon the lead itself.
 */
function makeService(published: Record<string, unknown> | null) {
  const svc = Object.create(LeadsService.prototype) as LeadsService & Record<string, unknown>;
  const leads = {
    create: jest.fn((x: Record<string, unknown>) => x),
    save: jest.fn(async (x: Record<string, unknown>) => ({ id: 'lead-1', ...x })),
  };
  const placementPackages = { findPublished: jest.fn().mockResolvedValue(published) };
  const notifications = { enqueue: jest.fn().mockResolvedValue(undefined) };
  Object.assign(svc, {
    leads,
    placementPackages,
    notifications,
    listings: { findOne: jest.fn() },
    redis: { client: { incr: jest.fn().mockResolvedValue(1), expire: jest.fn() } },
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    config: { LEAD_RATE_PER_HOUR: 5 },
  });
  return { svc, leads, placementPackages, notifications };
}

const PACKAGE_ID = '6f1c2a5e-3b7d-4e8f-9a01-2b3c4d5e6f70';

const sellRequest = {
  type: 'sell_request',
  name: 'Olena',
  phone: '+380 67 123 45 67',
  carMake: 'Toyota',
  packageId: PACKAGE_ID,
} as CreateLeadDto;

const savedLead = (leads: { save: jest.Mock }) =>
  leads.save.mock.calls[0][0] as {
    message: string | null;
    details: Record<string, unknown> | null;
  };

describe('LeadsService.create with a placement package', () => {
  it('snapshots the package title and price into details and the message', async () => {
    const { svc, leads, notifications } = makeService({
      id: PACKAGE_ID,
      title: 'Instagram + історія',
      priceUah: 1200,
    });

    await svc.create(sellRequest, '203.0.113.7');

    const lead = savedLead(leads);
    expect(lead.details).toEqual({
      carMake: 'Toyota',
      packageId: PACKAGE_ID,
      packageTitle: 'Instagram + історія',
      packagePriceUah: 1200,
    });
    expect(lead.message).toMatch(/^Тариф: Instagram \+ історія \(1\s200 грн\)/);
    // The manager alert reuses the composed message, so the tariff reaches Telegram.
    const [, payload] = notifications.enqueue.mock.calls[0];
    expect(payload.body).toContain('Тариф: Instagram + історія');
  });

  it('saves the lead without the package when it is no longer published', async () => {
    const { svc, leads } = makeService(null);

    const saved = await svc.create(sellRequest, '203.0.113.7');

    expect(saved.id).toBe('lead-1');
    const lead = savedLead(leads);
    expect(lead.details).toEqual({ carMake: 'Toyota' });
    expect(lead.message).not.toContain('Тариф');
  });

  it('ignores a packageId on lead types other than sell_request', async () => {
    const { svc, leads, placementPackages } = makeService({
      id: PACKAGE_ID,
      title: 'Telegram',
      priceUah: 200,
    });

    await svc.create({ ...sellRequest, type: 'callback' } as CreateLeadDto, '203.0.113.7');

    expect(placementPackages.findPublished).not.toHaveBeenCalled();
    expect(savedLead(leads).details).toBeNull();
  });
});
