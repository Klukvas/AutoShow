import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
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
} from './dto/upsert-catalog.dto';

@ApiTags('admin:catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/catalog')
export class CatalogAdminController {
  constructor(private readonly admin: CatalogAdminService) {}

  @Post('makes')
  @ApiOperation({ summary: 'Create a vehicle make' })
  createMake(@Body() dto: UpsertMakeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.admin.createMake(dto, user);
  }
  @Patch('makes/:id')
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
  createModel(@Body() dto: UpsertModelDto, @CurrentUser() user: AuthenticatedUser) {
    return this.admin.createModel(dto, user);
  }
  @Patch('models/:id')
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
}
