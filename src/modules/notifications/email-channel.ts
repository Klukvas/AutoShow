import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import type { AppConfig } from '../../config/config.module';
import type { NotificationChannel, NotificationPayload } from './notification-channel';

/**
 * EmailChannel: log-only without SMTP config, real SMTP send once SMTP_HOST is
 * set. Wired through BullMQ via NotificationService, so a failed send throws
 * and the queue retries with backoff — no retry logic here.
 */
@Injectable()
export class EmailChannel implements NotificationChannel {
  readonly id = 'email';
  private readonly logger = new Logger(EmailChannel.name);
  private readonly transporter: Transporter | null;

  constructor(@Inject('APP_CONFIG') private readonly config: AppConfig) {
    this.transporter = config.SMTP_HOST
      ? createTransport({
          host: config.SMTP_HOST,
          port: config.SMTP_PORT ?? 587,
          // Port 465 is implicit TLS; 587/25 upgrade via STARTTLS.
          secure: (config.SMTP_PORT ?? 587) === 465,
          auth:
            config.SMTP_USER && config.SMTP_PASS
              ? { user: config.SMTP_USER, pass: config.SMTP_PASS }
              : undefined,
        })
      : null;
  }

  async send(payload: NotificationPayload): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        { to: payload.to, subject: payload.subject, meta: payload.meta },
        'Email NOT sent — SMTP_HOST is not configured (logged only)',
      );
      return;
    }
    try {
      const info = (await this.transporter.sendMail({
        from: this.config.EMAIL_FROM,
        to: payload.to,
        subject: payload.subject,
        text: payload.body,
        html: payload.html,
      })) as { messageId?: string };
      this.logger.log(
        { to: payload.to, subject: payload.subject, messageId: info.messageId },
        'Email sent',
      );
    } catch (err) {
      this.logger.error(
        { err, to: payload.to, subject: payload.subject, meta: payload.meta },
        'Email send failed — rethrowing so the notification queue retries',
      );
      throw err;
    }
  }
}
