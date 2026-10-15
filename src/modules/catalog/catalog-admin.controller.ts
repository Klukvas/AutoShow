import { FileInterceptor } from '@nestjs/platform-express';
import { CatalogLogoService, MAX_LOGO_BYTES, type LogoUpload } from './catalog-logo.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CatalogAdminService } from './catalog-admin.service';
import {
  UpsertColorDto,
  UpsertMakeDto,
  UpsertModelDto,
  UpsertOptionDto,
  UpsertSimpleCatalogDto,
  UpsertTagDto,
} from './dto/upsert-catalog.dto';

@ApiTags('admin:catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/catalog')
export class CatalogAdminController {
  constructor(
    private readonly admin: CatalogAdminService,
    private readonly logos: CatalogLogoService,
  ) {}

  @Get('makes')
  @Roles('admin', 'editor')
  listMakes() {
    return this.admin.listMakes();
  }

  @Get('models')
  @Roles('admin', 'editor')
  listModels(@Query('makeId', new ParseUUIDPipe({ optional: true })) makeId?: string) {
    return this.admin.listModels(makeId);
  }

  @Post('makes/:id/logo')
  @Roles('admin', 'editor')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_LOGO_BYTES, files: 1, fields: 0 } }),
  )
  uploadLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: LogoUpload | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.logos.upload(id, file, user);
  }

  @Delete('makes/:id/logo')
  @Roles('admin', 'editor')
  removeLogo(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.logos.remove(id, user);
  }

  // Editors create listings and must not be blocked by an unknown make/model —
  // these two POSTs are opened to them; the rest of the catalog stays admin.
  @Post('makes')
  @Roles('admin', 'editor')
  @ApiOperation({ summary: 'Create a vehicle make (logo is auto-fetched in background)' })
  createMake(@Body() dto: UpsertMakeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.admin.createMake(dto, user);
  }
  @Patch('makes/:id')
  @Roles('admin', 'editor')
  updateMake(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertMakeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.updateMake(id, dto, user);
  }
  @Delete('makes/:id')
  @HttpCode(204)
  deleteMake(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.admin.deleteMake(id, user);
  }

  @Post('models')
  @Roles('admin', 'editor')
  createModel(@Body() dto: UpsertModelDto, @CurrentUser() user: AuthenticatedUser) {
    return this.admin.createModel(dto, user);
  }
  @Patch('models/:id')
  @Roles('admin', 'editor')
  updateModel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertModelDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.updateModel(id, dto, user);
  }
  @Delete('models/:id')
  @HttpCode(204)
  deleteModel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.admin.deleteModel(id, user);
  }

  @Post('body-types') createBodyType(
    @Body() dto: UpsertSimpleCatalogDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.createBodyType(dto, user);
  }
  @Post('fuel-types') createFuelType(
    @Body() dto: UpsertSimpleCatalogDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.createFuelType(dto, user);
  }
  @Post('transmissions') createTransmission(
    @Body() dto: UpsertSimpleCatalogDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.createTransmission(dto, user);
  }
  @Post('drive-types') createDriveType(
    @Body() dto: UpsertSimpleCatalogDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.createDriveType(dto, user);
  }
  @Post('colors') createColor(@Body() dto: UpsertColorDto, @CurrentUser() user: AuthenticatedUser) {
    return this.admin.createColor(dto, user);
  }
  @Post('options') createOption(
    @Body() dto: UpsertOptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.createOption(dto, user);
  }

  // Editors attach tags while creating listings, so listing is opened to them
  // (like makes/models); curating the dictionary stays admin-only.
  @Get('tags')
  @Roles('admin', 'editor')
  @ApiOperation({ summary: 'List all tags (including unpublished) for management/pickers' })
  listTags() {
    return this.admin.listTags();
  }
  @Post('tags') createTag(@Body() dto: UpsertTagDto, @CurrentUser() user: AuthenticatedUser) {
    return this.admin.createTag(dto, user);
  }
  @Patch('tags/:id')
  updateTag(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertTagDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.updateTag(id, dto, user);
  }
  @Delete('tags/:id')
  @HttpCode(204)
  deleteTag(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.admin.deleteTag(id, user);
  }
}
