import type { AppConfig } from '../../config/config.module';
import type { CreateLeadDto } from './dto/create-lead.dto';
import { LeadsService } from './leads.service';

/**
 * LeadsService.create on a prototype instance with mocked repos — the lead
 * notification fan-out is the part a dealership notices when it breaks, so it
 * is covered here independently of the CRM methods (lead-crm.spec.ts).
 *
 * Telegram is the only lead-alert channel; email was removed deliberately, so
 * the "no other channel" assertions below are regression guards, not noise.
 */
function makeService(config: Partial<AppConfig> = {}) {
  const svc = Object.create(LeadsService.prototype) as LeadsService & Record<string, unknown>;
  const leads = {
    create: jest.fn((x: Record<string, unknown>) => x),
    save: jest.fn(async (x: Record<string, unknown>) => ({ id: 'lead-1', ...x })),
  };
  const listings = { findOne: jest.fn().mockResolvedValue({ id: 'listing-1' }) };
  const notifications = { enqueue: jest.fn().mockResolvedValue(undefined) };
  const redis = {
    client: { incr: jest.fn().mockResolvedValue(1), expire: jest.fn().mockResolvedValue(1) },
  };
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  Object.assign(svc, {
    leads,
    listings,
    notifications,
    redis,
    logger,
    config: {
      LEAD_RATE_PER_HOUR: 5,
      ...config,
    },
  });
  return { svc, leads, notifications, logger };
}

const callback: CreateLeadDto = {
  type: 'callback',
  name: 'Ivan',
  phone: '+380 50 111 22 33',
} as CreateLeadDto;

function enqueuedChannels(enqueue: jest.Mock): string[] {
  return enqueue.mock.calls.map(([channelId]) => channelId as string);
}

function payloadFor(enqueue: jest.Mock, channelId: string) {
  const call = enqueue.mock.calls.find(([id]) => id === channelId);
  return call?.[1] as { to: string; subject: string; body: string; meta?: Record<string, unknown> };
}

describe('LeadsService.create notifications', () => {
  it('persists the lead and enqueues the Telegram alert only', async () => {
    const { svc, leads, notifications } = makeService();

    const saved = await svc.create(callback, '203.0.113.7');

    expect(leads.save).toHaveBeenCalledTimes(1);
    expect(saved.id).toBe('lead-1');
    expect(enqueuedChannels(notifications.enqueue)).toEqual(['telegram']);

    const telegram = payloadFor(notifications.enqueue, 'telegram');
    // The chat id lives in site_settings and is resolved by the channel at
    // send time — the job must not carry it.
    expect(telegram.to).toBe('telegram');
    expect(telegram.subject).toContain('Ivan');
    expect(telegram.body).toContain('+380 50 111 22 33');
    expect(telegram.meta).toEqual({ leadId: 'lead-1' });
  });

  it('still alerts Telegram only when the visitor leaves an email address', async () => {
    const { svc, notifications } = makeService();

    await svc.create({ ...callback, email: 'ivan@example.com' } as CreateLeadDto, '203.0.113.7');

    expect(enqueuedChannels(notifications.enqueue)).toEqual(['telegram']);
    // The visitor's own email still belongs in the alert body — only the email
    // *delivery channel* is gone.
    expect(payloadFor(notifications.enqueue, 'telegram').body).toContain('ivan@example.com');
  });

  it('includes the composed sell_request details in the alert body', async () => {
    const { svc, notifications } = makeService();

    await svc.create(
      {
        ...callback,
        type: 'sell_request',
        carMake: 'Audi',
        carModel: 'A6',
        carYear: 2019,
        message: 'Передзвоніть після 18:00',
        sourceUrl: 'https://autos-sale.com/sell',
      } as CreateLeadDto,
      '203.0.113.7',
    );

    const body = payloadFor(notifications.enqueue, 'telegram').body;
    expect(body).toContain('Audi A6');
    expect(body).toContain('2019');
    expect(body).toContain('Передзвоніть після 18:00');
    expect(body).toContain('https://autos-sale.com/sell');
  });

  it('notifies nobody and persists nothing when the honeypot is filled', async () => {
    const { svc, leads, notifications } = makeService();

    await svc.create({ ...callback, website: 'http://spam.example' } as CreateLeadDto, undefined);

    expect(leads.save).not.toHaveBeenCalled();
    expect(notifications.enqueue).not.toHaveBeenCalled();
  });

  it('keeps lead creation successful and logs when the enqueue fails', async () => {
    const { svc, notifications, logger } = makeService();
    notifications.enqueue.mockRejectedValueOnce(new Error('redis is down'));

    const saved = await svc.create(callback, '203.0.113.7');

    expect(saved.id).toBe('lead-1');
    // The lead survives a dead queue, and the failure is not silent.
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ channelId: 'telegram', leadId: 'lead-1' }),
      expect.stringContaining('Failed to enqueue lead notification'),
    );
  });
});
