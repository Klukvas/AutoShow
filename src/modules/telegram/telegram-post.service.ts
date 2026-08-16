import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { IsNull, Repository } from 'typeorm';
import type { AppConfig } from '../../config/config.module';
import { TELEGRAM_QUEUE } from '../../workers/queue.tokens';
import { BrandingService } from '../branding/branding.service';
import type { TelegramSettings } from '../branding/entities/site-settings.entity';
import { Listing } from '../listings/entities/listing.entity';
import { StorageService } from '../storage/storage.service';
import { ListingTelegramPost } from './entities/listing-telegram-post.entity';
import { TelegramApiClient, type TelegramMediaItem } from './telegram-api.client';
import { buildListingCaption } from './telegram-caption';

export interface TelegramJob {
  listingId: string;
}

export interface TelegramPostView {
  chatId: string;
  label: string | null;
  postedAt: Date;
  soldMarkedAt: Date | null;
}

const MAX_ALBUM_PHOTOS = 10;

const JOB_OPTS = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 10_000 },
  removeOnComplete: 1_000,
  removeOnFail: 5_000,
} as const;

/** Telegram errors that mean the target message is gone/unchanged — treat the
 * sold-mark as done instead of retrying forever. */
const EDIT_SKIPPABLE = ['message to edit not found', 'message is not modified'];

@Injectable()
export class TelegramPostService {
  private readonly logger = new Logger(TelegramPostService.name);

  constructor(
    @InjectRepository(ListingTelegramPost)
    private readonly posts: Repository<ListingTelegramPost>,
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    private readonly branding: BrandingService,
    private readonly storage: StorageService,
    private readonly api: TelegramApiClient,
    @InjectQueue(TELEGRAM_QUEUE) private readonly queue: Queue<TelegramJob>,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
  ) {}

  /** Usable settings or null — feature is dormant without token + channels. */
  private async settings(): Promise<TelegramSettings | null> {
    const telegram = (await this.branding.getCurrent()).telegram;
    if (!telegram?.botToken || !telegram.channels?.length) return null;
    return telegram;
  }

  /* =====================================================================
   *  Enqueue side (runs in the API app)
   * ===================================================================== */

  /**
   * First-publish hook. Must NEVER fail the status transition — a Telegram
   * outage should not block putting a car on the storefront.
   */
  async enqueueAutoPost(listingId: string): Promise<void> {
    try {
      const settings = await this.settings();
      if (!settings?.autoPublish) return;
      await this.queue.add('post', { listingId }, JOB_OPTS);
    } catch (err) {
      this.logger.warn({ err, listingId }, 'failed to enqueue telegram auto-post');
    }
  }

  /** mark-sold hook: edit existing posts to «ПРОДАНО». Same never-throw rule. */
  async enqueueMarkSold(listingId: string): Promise<void> {
    try {
      const telegram = (await this.branding.getCurrent()).telegram;
      if (!telegram?.botToken) return;
      const hasPosts = await this.posts.count({ where: { listingId, deletedAt: IsNull() } });
      if (!hasPosts) return;
      await this.queue.add('mark-sold', { listingId }, JOB_OPTS);
    } catch (err) {
      this.logger.warn({ err, listingId }, 'failed to enqueue telegram mark-sold');
    }
  }

  /** Manual button in the admin UI — errors here DO surface to the user. */
  async enqueueManualPost(listingId: string): Promise<{ enqueuedChannels: number }> {
    const settings = await this.settings();
    if (!settings) {
      throw new UnprocessableEntityException(
        'Telegram is not configured — set the bot token and at least one channel in branding settings',
      );
    }
    const listing = await this.listings.findOne({ where: { id: listingId, deletedAt: IsNull() } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.status !== 'published' && listing.status !== 'reserved') {
      throw new UnprocessableEntityException('Only published listings can be posted to Telegram');
    }
    const existing = await this.posts.find({ where: { listingId, deletedAt: IsNull() } });
    const remaining = settings.channels.filter(
      (channel) => !existing.some((post) => post.chatId === channel.chatId),
    );
    if (!remaining.length) {
      throw new ConflictException('Listing is already posted to all configured channels');
    }
    await this.queue.add('post', { listingId }, JOB_OPTS);
    return { enqueuedChannels: remaining.length };
  }

  /** Post history for the admin panel (labels resolved from current settings). */
  async postsFor(listingId: string): Promise<TelegramPostView[]> {
    const telegram = (await this.branding.getCurrent()).telegram;
    const rows = await this.posts.find({
      where: { listingId, deletedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => ({
      chatId: row.chatId,
      label: telegram?.channels.find((c) => c.chatId === row.chatId)?.label ?? null,
      postedAt: row.createdAt,
      soldMarkedAt: row.soldMarkedAt,
    }));
  }

  /* =====================================================================
   *  Execute side (runs in the worker)
   * ===================================================================== */

  /**
   * Post the listing to every configured channel that doesn't already have a
   * live post. Channel-level idempotency (row per listing+chat, backed by a
   * unique partial index) makes BullMQ retries safe: a retry after a partial
   * failure re-sends only to the channels that are still missing.
   */
  async postListing(listingId: string): Promise<void> {
    const settings = await this.settings();
    if (!settings) return;
    const listing = await this.listings.findOne({
      where: { id: listingId, deletedAt: IsNull() },
      relations: ['fuelType', 'transmission', 'media', 'media.renditions'],
    });
    if (!listing) return;
    if (listing.status !== 'published' && listing.status !== 'reserved') {
      // Archived/sold between enqueue and processing — a stale post would
      // advertise a car that is no longer for sale.
      this.logger.log({ listingId, status: listing.status }, 'telegram post skipped: not public');
      return;
    }
    const photos = this.photoUrls(listing);
    if (!photos.length) {
      this.logger.warn({ listingId }, 'telegram post skipped: no ready photos');
      return;
    }

    const caption = buildListingCaption(listing, this.config.PUBLIC_SITE_URL);
    const existing = await this.posts.find({ where: { listingId, deletedAt: IsNull() } });

    for (const channel of settings.channels) {
      if (existing.some((post) => post.chatId === channel.chatId)) continue;
      const messages =
        photos.length === 1
          ? [await this.api.sendPhoto(settings.botToken!, channel.chatId, photos[0], caption)]
          : await this.api.sendMediaGroup(
              settings.botToken!,
              channel.chatId,
              photos.map(
                (url, idx): TelegramMediaItem =>
                  idx === 0
                    ? { type: 'photo', media: url, caption, parse_mode: 'HTML' }
                    : { type: 'photo', media: url },
              ),
            );
      await this.posts.save(
        this.posts.create({
          listingId,
          chatId: channel.chatId,
          messageIds: messages.map((m) => m.message_id),
          captionMessageId: messages[0].message_id,
          soldMarkedAt: null,
        }),
      );
      this.logger.log(
        { listingId, chatId: channel.chatId, photos: photos.length },
        'listing posted to telegram channel',
      );
    }
  }

  /** Rewrite each post's caption with the «ПРОДАНО» variant. */
  async markSoldPosts(listingId: string): Promise<void> {
    const telegram = (await this.branding.getCurrent()).telegram;
    if (!telegram?.botToken) return;
    const listing = await this.listings.findOne({
      where: { id: listingId, deletedAt: IsNull() },
      relations: ['fuelType', 'transmission'],
    });
    if (!listing) return;

    const caption = buildListingCaption(listing, this.config.PUBLIC_SITE_URL, { sold: true });
    const posts = await this.posts.find({ where: { listingId, deletedAt: IsNull() } });
    for (const post of posts) {
      if (post.soldMarkedAt) continue;
      try {
        await this.api.editMessageCaption(
          telegram.botToken,
          post.chatId,
          post.captionMessageId,
          caption,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        // Deleted-by-hand posts (or an identical caption) must not keep the
        // job retrying — mark and move on; real API failures still retry.
        if (!EDIT_SKIPPABLE.some((fragment) => message.includes(fragment))) throw err;
        this.logger.warn(
          { listingId, chatId: post.chatId, message },
          'telegram sold-mark skipped for this post',
        );
      }
      await this.posts.save({ ...post, soldMarkedAt: new Date() });
    }
  }

  /**
   * Cover-first public photo URLs, capped at Telegram's album limit. Prefers
   * the jpeg gallery rendition — Telegram treats webp as stickers and the
   * original can exceed the Bot API's 10 MB URL-fetch limit.
   */
  private photoUrls(listing: Listing): string[] {
    return (listing.media ?? [])
      .filter((m) => m.type === 'image' && m.status === 'ready' && !m.deletedAt)
      .sort((a, b) => Number(b.isCover) - Number(a.isCover) || a.position - b.position)
      .slice(0, MAX_ALBUM_PHOTOS)
      .map((m) => {
        const renditions = m.renditions ?? [];
        const rendition =
          renditions.find((r) => r.variant === 'gallery' && r.format === 'jpeg') ??
          renditions.find((r) => r.variant === 'full' && r.format === 'jpeg') ??
          renditions.find((r) => r.format === 'jpeg');
        return this.storage.publicUrlFor(rendition?.s3Key ?? m.originalS3Key);
      });
  }
}
