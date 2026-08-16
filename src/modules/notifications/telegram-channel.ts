import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { SiteSettings } from '../branding/entities/site-settings.entity';
import { TelegramApiClient } from '../telegram/telegram-api.client';
import type { NotificationChannel, NotificationPayload } from './notification-channel';

/**
 * TelegramLeadChannel: internal manager alerts (new lead) delivered to the
 * chat configured in site_settings.telegram.leadChatId, reusing the same bot
 * token as public channel posts. Reads settings from the DB at send time (runs
 * in the worker process) rather than at boot, so an admin can enable alerts
 * without a redeploy.
 *
 * Mirrors EmailChannel's "graceful when unconfigured" contract: if there is no
 * bot token or no lead chat, it logs at debug and returns — it does NOT throw,
 * so the queue does not retry a job that can never succeed.
 */
@Injectable()
export class TelegramLeadChannel implements NotificationChannel {
  readonly id = 'telegram';
  private readonly logger = new Logger(TelegramLeadChannel.name);

  constructor(
    @InjectRepository(SiteSettings)
    private readonly settings: Repository<SiteSettings>,
    private readonly api: TelegramApiClient,
  ) {}

  async send(payload: NotificationPayload): Promise<void> {
    const current = await this.settings.findOne({ where: { deletedAt: IsNull() } });
    const token = current?.telegram?.botToken ?? null;
    const chatId = current?.telegram?.leadChatId ?? null;
    if (!token || !chatId) {
      this.logger.debug(
        { hasToken: Boolean(token), hasChat: Boolean(chatId), meta: payload.meta },
        'Telegram lead alert skipped — bot token or leadChatId not configured',
      );
      return;
    }
    // subject + body as one plain-text message; a leading bold-ish header helps
    // it stand out in the chat. Plain text (no parse_mode) — see sendMessage.
    const text = `🔔 ${payload.subject}\n\n${payload.body}`;
    await this.api.sendMessage(token, chatId, text);
    this.logger.log({ meta: payload.meta }, 'Telegram lead alert sent');
  }
}
