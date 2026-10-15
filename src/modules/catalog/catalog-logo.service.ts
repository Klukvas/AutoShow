import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { IsNull, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuditLogService } from '../audit/audit-log.service';
import { StorageService } from '../storage/storage.service';
import { CatalogService } from './catalog.service';
import { Make } from './entities/make.entity';

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_LOGO_PIXELS = 16_000_000;
export type LogoUpload = { buffer: Buffer; mimetype: string; size: number };

function isAnimatedPng(buffer: Buffer): boolean {
  if (!buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
  for (let offset = 8; offset + 12 <= buffer.length; ) {
    const length = buffer.readUInt32BE(offset);
    if (length > buffer.length - offset - 12) throw new Error('truncated PNG');
    if (buffer.toString('ascii', offset + 4, offset + 8) === 'acTL') return true;
    offset += length + 12;
  }
  return false;
}

export async function normalizeLogo(file: LogoUpload | undefined): Promise<Buffer> {
  if (!file?.buffer?.length || file.buffer.length > MAX_LOGO_BYTES) {
    throw new BadRequestException('Оберіть PNG, JPEG або WebP розміром до 2 МБ');
  }
  try {
    if (isAnimatedPng(file.buffer)) throw new Error('animated PNG');
    const image = sharp(file.buffer, {
      limitInputPixels: MAX_LOGO_PIXELS,
      failOn: 'warning',
      animated: true,
    });
    const metadata = await image.metadata();
    const mime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };
    if (
      !metadata.format ||
      !(metadata.format in mime) ||
      mime[metadata.format as keyof typeof mime] !== file.mimetype ||
      (metadata.pages ?? 1) !== 1 ||
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height > MAX_LOGO_PIXELS
    )
      throw new Error('unsupported image');
    return await image
      .rotate()
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    throw new BadRequestException(
      'Файл пошкоджений або має непідтримуваний формат. Використайте статичний PNG, JPEG або WebP до 16 мегапікселів',
    );
  }
}

/** Each object belongs to one write; legacy shared slug keys are never deleted here. */
export function isOwnedLogoKey(key: string | null, makeId: string): key is string {
  return Boolean(key?.startsWith(`catalog/makes/${makeId}/`));
}

@Injectable()
export class CatalogLogoService {
  private readonly logger = new Logger(CatalogLogoService.name);
  constructor(
    @InjectRepository(Make) private readonly makes: Repository<Make>,
    private readonly storage: StorageService,
    private readonly catalog: CatalogService,
    private readonly audit: AuditLogService,
  ) {}

  async upload(id: string, file: LogoUpload | undefined, actor: AuthenticatedUser) {
    const normalized = await normalizeLogo(file);
    const make = await this.requireMake(id);
    const key = `catalog/makes/${id}/${randomUUID()}.png`;
    try {
      await this.storage.putBuffer(key, normalized, 'image/png');
    } catch (error) {
      this.logger.warn({ error, makeId: id }, 'make logo upload failed');
      throw new ServiceUnavailableException('Не вдалося завантажити логотип. Спробуйте ще раз');
    }
    try {
      const result = await this.makes.update(
        { id, version: make.version, deletedAt: IsNull() },
        { logoS3Key: key, logoMode: 'manual', logoCheckedAt: new Date() },
      );
      if (!result.affected)
        throw new ConflictException('Марку вже змінено. Оновіть дані та спробуйте ще раз');
    } catch (error) {
      await this.cleanup(key, id);
      throw error;
    }
    await this.cleanup(make.logoS3Key, id);
    await this.changed(id, 'upload', actor);
    return { logoUrl: this.storage.publicUrlFor(key) };
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const make = await this.requireMake(id);
    const result = await this.makes.update(
      { id, version: make.version, deletedAt: IsNull() },
      { logoS3Key: null, logoMode: 'none', logoCheckedAt: new Date() },
    );
    if (!result.affected)
      throw new ConflictException('Марку вже змінено. Оновіть дані та спробуйте ще раз');
    await this.cleanup(make.logoS3Key, id);
    await this.changed(id, 'remove', actor);
    return { logoUrl: null };
  }

  private async requireMake(id: string) {
    const make = await this.makes.findOne({ where: { id, deletedAt: IsNull() } });
    if (!make) throw new NotFoundException('Марку не знайдено');
    return make;
  }
  private async cleanup(key: string | null, makeId: string) {
    if (!isOwnedLogoKey(key, makeId)) return;
    try {
      await this.storage.delete(key);
    } catch (error) {
      this.logger.warn({ error, key }, 'obsolete make logo cleanup failed');
    }
  }
  private async changed(id: string, action: string, actor: AuthenticatedUser) {
    await this.catalog.invalidate();
    await this.audit.record({
      action: `catalog.make.logo.${action}`,
      entityType: 'make',
      entityId: id,
      actorId: actor.id,
      actorRole: actor.role,
    });
  }
}
