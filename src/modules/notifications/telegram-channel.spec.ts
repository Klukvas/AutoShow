import { Repository } from 'typeorm';
import { SiteSettings } from '../branding/entities/site-settings.entity';
import { TelegramApiClient } from '../telegram/telegram-api.client';
import { TelegramLeadChannel } from './telegram-channel';

function makeChannel(settings: Partial<SiteSettings> | null) {
  const repo = {
    findOne: jest.fn().mockResolvedValue(settings),
  } as unknown as Repository<SiteSettings>;
  const api = { sendMessage: jest.fn().mockResolvedValue(undefined) } as unknown as TelegramApiClient;
  const channel = new TelegramLeadChannel(repo, api);
  return { channel, api };
}

const payload = { to: 'telegram', subject: 'New lead', body: 'Name: Ivan', meta: { leadId: 'l1' } };

describe('TelegramLeadChannel', () => {
  it('no-ops (no throw, no send) when telegram is unconfigured', async () => {
    const { channel, api } = makeChannel(null);
    await expect(channel.send(payload)).resolves.toBeUndefined();
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('no-ops when a bot token exists but leadChatId is missing', async () => {
    const { channel, api } = makeChannel({
      telegram: { botToken: '123:abc', channels: [], autoPublish: false, leadChatId: null },
    });
    await channel.send(payload);
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('sends to the lead chat when token and leadChatId are both set', async () => {
    const { channel, api } = makeChannel({
      telegram: { botToken: '123:abc', channels: [], autoPublish: false, leadChatId: '-100999' },
    });
    await channel.send(payload);
    expect(api.sendMessage).toHaveBeenCalledTimes(1);
    const [token, chatId, text] = (api.sendMessage as jest.Mock).mock.calls[0];
    expect(token).toBe('123:abc');
    expect(chatId).toBe('-100999');
    expect(text).toContain('New lead');
    expect(text).toContain('Name: Ivan');
  });
});
