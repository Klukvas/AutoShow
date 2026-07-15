import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Public } from '../../common/decorators/public.decorator';
import { Listing } from '../listings/entities/listing.entity';

/** Trust numbers for the storefront homepage — deliberately coarse. */
@ApiTags('public:stats')
@Public()
@Controller('stats')
export class StatsPublicController {
  constructor(@InjectRepository(Listing) private readonly listings: Repository<Listing>) {}

  @Get()
  @ApiOperation({ summary: 'Public counters: cars available / sold / total views' })
  async stats(): Promise<{ available: number; sold: number; views: number }> {
    const [row] = await this.listings.query(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('published', 'reserved'))::int AS available,
        COUNT(*) FILTER (WHERE status = 'sold')::int AS sold,
        COALESCE(SUM(views_count), 0)::int AS views
      FROM listings
      WHERE deleted_at IS NULL
    `);
    return { available: row.available, sold: row.sold, views: row.views };
  }
}
