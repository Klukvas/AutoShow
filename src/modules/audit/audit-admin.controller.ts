import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Brackets, Repository } from 'typeorm';
import { Roles } from '../../common/decorators/roles.decorator';
import { decodeCursor, encodeCursor } from '../../common/pagination/cursor';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AuditLog } from './entities/audit-log.entity';

class ListAuditQuery {
  @IsOptional()
  @IsIn(['listing', 'listing_media', 'admin_user', 'site_settings', 'lead'])
  entityType?: string;
  @IsOptional() @IsUUID() entityId?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

@ApiTags('admin:audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/audit')
export class AuditAdminController {
  constructor(
    @InjectRepository(AuditLog)
    private readonly audit: Repository<AuditLog>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Read audit log entries (keyset-paginated)' })
  async list(@Query() q: ListAuditQuery) {
    const limit = Math.min(q.limit ?? 50, 200);
    const qb = this.audit
      .createQueryBuilder('a')
      .orderBy('a.created_at', 'DESC')
      .addOrderBy('a.id', 'DESC');

    if (q.entityType) qb.andWhere('a.entity_type = :et', { et: q.entityType });
    if (q.entityId) qb.andWhere('a.entity_id = :eid', { eid: q.entityId });
    if (q.action) qb.andWhere('a.action = :ac', { ac: q.action });

    if (q.cursor) {
      const cursor = decodeCursor(q.cursor);
      if (cursor) {
        qb.andWhere(
          new Brackets((b) => {
            b.where('a.created_at < :ck', { ck: cursor.k }).orWhere(
              new Brackets((bb) => {
                bb.where('a.created_at = :ck').andWhere('a.id < :ci', { ci: cursor.i });
              }),
            );
          }),
        );
      }
    }

    qb.limit(limit + 1);
    const rows = await qb.getMany();
    let nextCursor: string | null = null;
    let items = rows;
    if (rows.length > limit) {
      items = rows.slice(0, limit);
      const last = items[items.length - 1];
      nextCursor = encodeCursor({ k: last.createdAt.toISOString(), i: last.id });
    }
    return { items, nextCursor };
  }
}
