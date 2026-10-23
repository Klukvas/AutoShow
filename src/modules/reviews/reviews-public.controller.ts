import { RequiresFeature } from '../installation/feature.guard';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ReviewsService } from './reviews.service';

@ApiTags('public:reviews')
@Public()
@RequiresFeature('reviews')
@Controller('reviews')
export class ReviewsPublicController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'Published customer reviews (curated order)' })
  list() {
    return this.reviews.listPublished();
  }
}
