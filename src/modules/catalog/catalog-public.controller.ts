import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { StorageService } from '../storage/storage.service';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Public()
@Controller('catalog')
export class CatalogPublicController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly storage: StorageService,
  ) {}

  @Get('makes')
  @ApiOperation({ summary: 'List vehicle makes (cached; logoUrl when fetched)' })
  async makes() {
    const makes = await this.catalog.listMakes();
    // Explicit whitelist: clients get a ready-to-render logo URL; the raw S3
    // key and the fetch bookkeeping stay off the wire.
    return makes.map((make) => ({
      id: make.id,
      slug: make.slug,
      nameUk: make.nameUk,
      nameEn: make.nameEn,
      logoUrl: make.logoS3Key ? this.storage.publicUrlFor(make.logoS3Key) : null,
    }));
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

  @Get('tags')
  @ApiOperation({ summary: 'List published storefront tags (badge/filter facet)' })
  tags() {
    return this.catalog.listTags();
  }
}
