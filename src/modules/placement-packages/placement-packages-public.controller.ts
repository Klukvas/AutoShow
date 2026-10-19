import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PlacementPackagesService } from './placement-packages.service';

@ApiTags('public:placement-packages')
@Public()
@Controller('placement-packages')
export class PlacementPackagesPublicController {
  constructor(private readonly packages: PlacementPackagesService) {}

  @Get()
  @ApiOperation({ summary: 'Published placement packages (curated order)' })
  list() {
    return this.packages.listPublished();
  }
}
