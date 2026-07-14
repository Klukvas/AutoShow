export interface NotificationPayload {
  to: string;
  subject: string;
  body: string;
  html?: string;
  meta?: Record<string, unknown>;
}

export interface NotificationChannel {
  readonly id: string;
  send(payload: NotificationPayload): Promise<void>;
}
