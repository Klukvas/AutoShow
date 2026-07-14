import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Public()
@Controller('catalog')
export class CatalogPublicController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('makes')
  @ApiOperation({ summary: 'List vehicle makes (cached)' })
  makes() {
    return this.catalog.listMakes();
  }

  @Get('models')
  @ApiOperation({ summary: 'List vehicle models, optionally filtered by make slug' })
  models(@Query('make') make?: string) {
    return this.catalog.listModels(make);
  }

  @Get('body-types')
  bodyTypes() {
    return this.catalog.listBodyTypes();
  }

  @Get('fuel-types')
  fuelTypes() {
    return this.catalog.listFuelTypes();
  }

  @Get('transmissions')
  transmissions() {
    return this.catalog.listTransmissions();
  }

  @Get('drive-types')
  driveTypes() {
    return this.catalog.listDriveTypes();
  }

  @Get('colors')
  colors() {
    return this.catalog.listColors();
  }

  @Get('options')
  options() {
    return this.catalog.listOptions();
  }
}
