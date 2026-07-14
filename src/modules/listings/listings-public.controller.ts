import {
  Controller,
  Get,
  HttpCode,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { ViewCounterService } from '../views/view-counter.service';
import { ListListingsQuery } from './dto/list-listings.query';
import { ListingsMapper } from './listings.mapper';
import { ListingsService } from './listings.service';

@ApiTags('public-listings')
@Public()
@Controller('listings')
export class ListingsPublicController {
  private readonly logger = new Logger(ListingsPublicController.name);

  constructor(
    private readonly listings: ListingsService,
    private readonly mapper: ListingsMapper,
    private readonly views: ViewCounterService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List published listings (cursor-paginated, facet filters)' })
  async list(@Query() query: ListListingsQuery) {
    const page = await this.listings.findPublishedPage(query);
    return {
      items: page.items.map((l) => this.mapper.public(l)),
      nextCursor: page.nextCursor,
      total: page.total,
    };
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get published listing by slug (with SEO + JSON-LD + srcset)' })
  async byId(@Param('slug') slug: string) {
    // View tracking is NOT done here: this GET is cached by the storefront (ISR)
    // and served from the Next server's IP, so counting here would dedup to ~1
    // view per listing. Views are counted via the client beacon below instead.
    const listing = await this.listings.findPublishedBySlug(slug);
    return this.mapper.public(listing);
  }

  @Post(':id/view')
  @HttpCode(204)
  @ApiOperation({ summary: 'Record a listing view (client beacon; IP-deduped)' })
  async trackView(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    // Fired directly from the visitor's browser, so req.ip is the real client
    // (dedup is per real IP). Best-effort — never fail the beacon.
    void this.views.track(id, req.ip).catch((err) => {
      this.logger.warn({ err, listingId: id }, 'failed to track listing view');
    });
  }
}
