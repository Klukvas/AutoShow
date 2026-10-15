import { BrandingPublicController } from './branding-public.controller';
import type { BrandingService } from './branding.service';
import type { SiteSettings } from './entities/site-settings.entity';

/**
 * The telegram block carries two secrets a storefront visitor must never see:
 * the bot token (a live credential) and leadChatId (the manager chat — knowing
 * it lets an outsider try to spam the dealership's internal alerts).
 */
const settings = {
  id: 's1',
  displayName: 'AutoFlow',
  telegram: {
    botToken: '123456789:AA-secret-token',
    channels: [{ chatId: '@autoflow' }],
    autoPublish: true,
    leadChatId: '-100999',
  },
} as unknown as SiteSettings;

describe('BrandingPublicController', () => {
  it('strips the whole telegram block from the public response', async () => {
    const branding = {
      getCurrent: jest.fn().mockResolvedValue(settings),
    } as unknown as BrandingService;
    const controller = new BrandingPublicController(branding);

    const body = await controller.get();

    expect(body.displayName).toBe('AutoFlow');
    expect('telegram' in body).toBe(false);
    expect(JSON.stringify(body)).not.toContain('123456789:AA-secret-token');
    expect(JSON.stringify(body)).not.toContain('-100999');
  });

  it('does not mutate the cached settings entity', async () => {
    const branding = {
      getCurrent: jest.fn().mockResolvedValue(settings),
    } as unknown as BrandingService;
    const controller = new BrandingPublicController(branding);

    await controller.get();

    expect(settings.telegram?.botToken).toBe('123456789:AA-secret-token');
    expect(settings.telegram?.leadChatId).toBe('-100999');
  });
});
