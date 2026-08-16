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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CollectionsService } from './collections.service';
import { CreateCollectionDto, UpdateCollectionDto } from './dto/upsert-collection.dto';

@ApiTags('admin:collections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/collections')
export class CollectionsAdminController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  @ApiOperation({ summary: 'List all collections (including unpublished)' })
  list() {
    return this.collections.listAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a curated collection' })
  create(@Body() dto: CreateCollectionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.collections.create(dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a collection' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCollectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.collections.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete a collection' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.collections.remove(id, user);
  }
}
