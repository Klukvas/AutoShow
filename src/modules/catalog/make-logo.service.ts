import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, Repository } from 'typeorm';
import { StorageService } from '../storage/storage.service';
import { CatalogService } from './catalog.service';
import { Make } from './entities/make.entity';
import { SimpleIconsClient } from './simple-icons.client';

/** A miss is retried by the sweep no sooner than this (icon sets grow). */
const RECHECK_AFTER_DAYS = 7;
const SWEEP_BATCH = 20;

/**
 * Fetches uniform monochrome brand icons (simple-icons) into our S3.
 * Best-effort by design: a make without a published glyph keeps the
 * letter-avatar in the UI — same monochrome style — and the attempt is
 * stamped (logoCheckedAt) so the sweep retries weekly, not hourly.
 */
@Injectable()
export class MakeLogoService {
  private readonly logger = new Logger(MakeLogoService.name);

  constructor(
    @InjectRepository(Make) private readonly makes: Repository<Make>,
    private readonly icons: SimpleIconsClient,
    private readonly storage: StorageService,
    private readonly catalog: CatalogService,
  ) {}

  /** Fetch + store the icon for one make. Never throws (best-effort). */
  async fetchLogo(makeId: string): Promise<void> {
    try {
      const make = await this.makes.findOne({ where: { id: makeId, deletedAt: IsNull() } });
      if (!make || make.logoS3Key) return;

      const icon = await this.icons.fetchIcon(make.slug, make.nameEn);
      let stored: string | null = null;
      if (icon) {
        const key = `catalog/makes/${make.slug}.png`;
        await this.storage.putBuffer(key, icon.buffer, icon.contentType);
        stored = key;
      }

      await this.makes.update({ id: make.id }, { logoS3Key: stored, logoCheckedAt: new Date() });
      // The public /catalog/makes response is Redis-cached — bust it so the
      // icon shows up right away, not after the TTL.
      if (stored) await this.catalog.invalidate();
      this.logger.log(
        { makeId: make.id, slug: make.slug, found: Boolean(stored) },
        stored ? 'make icon stored' : 'make icon not found in simple-icons',
      );
    } catch (err) {
      this.logger.warn({ err, makeId }, 'make icon fetch failed');
    }
  }

  /**
   * Backfill/retry pass for the hourly maintenance sweep: makes never checked
   * (pre-feature rows) or last missed over a week ago.
   */
  async sweepMissingLogos(): Promise<void> {
    const recheckBefore = new Date(Date.now() - RECHECK_AFTER_DAYS * 24 * 60 * 60 * 1000);
    const pending = await this.makes
      .createQueryBuilder('make')
      .where('make.deleted_at IS NULL')
      .andWhere('make.logo_s3_key IS NULL')
      .andWhere(
        new Brackets((qb) => {
          qb.where('make.logo_checked_at IS NULL').orWhere('make.logo_checked_at < :before', {
            before: recheckBefore,
          });
        }),
      )
      .orderBy('make.logo_checked_at', 'ASC', 'NULLS FIRST')
      .take(SWEEP_BATCH)
      .getMany();
    for (const make of pending) {
      await this.fetchLogo(make.id);
    }
  }
}
