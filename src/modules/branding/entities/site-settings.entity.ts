import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base/base.entity';
import type { Currency } from '../../../common/types/currency';

export interface WorkingHours {
  [day: string]: { open: string; close: string } | null;
}

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  telegram?: string;
  youtube?: string;
  tiktok?: string;
}

export interface SeoDefaults {
  titleTemplate?: string;
  description?: string;
  ogImage?: string;
}

export interface TelegramChannel {
  /** `@channelname` or a numeric chat id (`-100…`). */
  chatId: string;
  /** Human label for the admin UI only. */
  label?: string;
}

/**
 * Telegram publishing config. Lives in site_settings (admin-editable, no
 * redeploy) — NEVER returned by the public branding endpoint and masked in
 * audit diffs: botToken is a live credential.
 */
export interface TelegramSettings {
  botToken: string | null;
  channels: TelegramChannel[];
  /** Post automatically on a listing's FIRST publish. */
  autoPublish: boolean;
  /**
   * Chat that receives internal new-lead alerts (a private manager group or a
   * DM with the bot). Separate from `channels` (public listing posts). When
   * unset, lead alerts are silently skipped — the same bot token is reused.
   */
  leadChatId?: string | null;
}

/**
 * Singleton row holding the site's branding and the base currency used for
 * price normalization. The partial unique index on a constant expression
 * guarantees at most one alive row.
 */
@Entity('site_settings')
@Index('uq_site_settings_singleton', { synchronize: false })
export class SiteSettings extends BaseEntity {
  @Column({ name: 'logo_url', type: 'varchar', length: 512, nullable: true })
  logoUrl!: string | null;

  @Column({ name: 'favicon_url', type: 'varchar', length: 512, nullable: true })
  faviconUrl!: string | null;

  @Column({ name: 'primary_color', type: 'varchar', length: 9, default: '#0F172A' })
  primaryColor!: string;

  @Column({ name: 'accent_color', type: 'varchar', length: 9, default: '#2563EB' })
  accentColor!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 128 })
  displayName!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tagline!: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', length: 32, nullable: true })
  contactPhone!: string | null;

  @Column({ name: 'contact_email', type: 'varchar', length: 254, nullable: true })
  contactEmail!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  address!: string | null;

  @Column({ name: 'working_hours', type: 'jsonb', nullable: true })
  workingHours!: WorkingHours | null;

  @Column({ name: 'social_links', type: 'jsonb', nullable: true })
  socialLinks!: SocialLinks | null;

  @Column({ name: 'seo_defaults', type: 'jsonb', nullable: true })
  seoDefaults!: SeoDefaults | null;

  @Column({ name: 'default_currency', type: 'varchar', length: 3, default: 'USD' })
  defaultCurrency!: Currency;

  @Column({ type: 'jsonb', nullable: true })
  telegram!: TelegramSettings | null;
}
