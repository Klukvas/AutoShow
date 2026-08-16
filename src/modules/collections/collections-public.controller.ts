import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CollectionsService } from './collections.service';

@ApiTags('collections')
@Public()
@Controller('collections')
export class CollectionsPublicController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  @ApiOperation({ summary: 'List published curated collections (storefront + sitemap)' })
  list() {
    return this.collections.listPublished();
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get a published collection by key' })
  byKey(@Param('key') key: string) {
    return this.collections.getPublishedByKey(key);
  }
}
