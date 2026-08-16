import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface TelegramMediaItem {
  type: 'photo';
  media: string;
  caption?: string;
  parse_mode?: 'HTML';
}

export interface TelegramMessage {
  message_id: number;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

const API_BASE = 'https://api.telegram.org';
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Thin Bot API wrapper. The bot token is part of the request URL, so raw
 * axios errors must never be logged or rethrown — every failure is reduced
 * to method + status + Telegram's `description` before leaving this class.
 */
@Injectable()
export class TelegramApiClient {
  private readonly logger = new Logger(TelegramApiClient.name);

  /** Album post (2–10 photos; caption rides on the first item). */
  async sendMediaGroup(
    token: string,
    chatId: string,
    media: TelegramMediaItem[],
  ): Promise<TelegramMessage[]> {
    return this.call<TelegramMessage[]>(token, 'sendMediaGroup', { chat_id: chatId, media });
  }

  /** Single-photo post — used when a listing has exactly one ready photo. */
  async sendPhoto(
    token: string,
    chatId: string,
    photoUrl: string,
    caption: string,
  ): Promise<TelegramMessage> {
    return this.call<TelegramMessage>(token, 'sendPhoto', {
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: 'HTML',
    });
  }

  async editMessageCaption(
    token: string,
    chatId: string,
    messageId: number,
    caption: string,
  ): Promise<void> {
    await this.call(token, 'editMessageCaption', {
      chat_id: chatId,
      message_id: messageId,
      caption,
      parse_mode: 'HTML',
    });
  }

  /**
   * Plain text message — used for internal manager alerts (e.g. new lead).
   * No parse_mode by default: alert bodies are user-supplied (name/phone) and
   * sending them as-is avoids HTML-escaping bugs turning into 400s.
   */
  async sendMessage(
    token: string,
    chatId: string,
    text: string,
    parseMode?: 'HTML',
  ): Promise<void> {
    await this.call<TelegramMessage>(token, 'sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    });
  }

  private async call<T>(token: string, method: string, payload: unknown): Promise<T> {
    let response: TelegramApiResponse<T> | undefined;
    let status: number | undefined;
    try {
      const res = await axios.post<TelegramApiResponse<T>>(
        `${API_BASE}/bot${token}/${method}`,
        payload,
        { timeout: REQUEST_TIMEOUT_MS, validateStatus: () => true },
      );
      response = res.data;
      status = res.status;
    } catch (err) {
      // Network-level failure: sanitize — axios errors embed the tokened URL.
      const message = err instanceof Error ? err.message : 'unknown network error';
      this.logger.error({ method, message }, 'Telegram API request failed');
      throw new Error(`Telegram ${method} failed: ${message}`);
    }
    if (!response?.ok || response.result === undefined) {
      const description = response?.description ?? `HTTP ${status}`;
      this.logger.error({ method, status, description }, 'Telegram API returned an error');
      throw new Error(`Telegram ${method} failed: ${description}`);
    }
    return response.result;
  }
}
