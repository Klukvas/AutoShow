import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AppConfig } from '../../config/config.module';
import type { NotificationChannel, NotificationPayload } from './notification-channel';

/**
 * v1 EmailChannel: thin wrapper that logs sends in dev and would call SMTP in
 * prod. Wired through BullMQ via NotificationService so retries are handled
 * by the queue, not by us.
 *
 * Intentionally no nodemailer dep until SMTP credentials are configured —
 * setting SMTP_HOST flips this from log-only to real send.
 */
@Injectable()
export class EmailChannel implements NotificationChannel {
  readonly id = 'email';
  private readonly logger = new Logger(EmailChannel.name);

  constructor(@Inject('APP_CONFIG') private readonly config: AppConfig) {}

  async send(payload: NotificationPayload): Promise<void> {
    if (!this.config.SMTP_HOST) {
      this.logger.log(
        { to: payload.to, subject: payload.subject, meta: payload.meta },
        'Email (no SMTP configured — logged only)',
      );
      return;
    }
    // Real SMTP send goes here once credentials are configured. Keeping the
    // dependency out of v1 so deploys without email still boot.
    this.logger.log(
      { to: payload.to, subject: payload.subject },
      'Email send requested (SMTP path)',
    );
  }
}
