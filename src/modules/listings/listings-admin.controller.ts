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
  Query,
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
import { AdminListListingsQuery } from './dto/admin-list-listings.query';
import { CreateListingDto } from './dto/create-listing.dto';
import { TransitionStatusDto } from './dto/transition-status.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingsMapper } from './listings.mapper';
import { ListingsService } from './listings.service';

@ApiTags('admin:listings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'editor')
@Controller('admin/listings')
export class ListingsAdminController {
  constructor(
    private readonly listings: ListingsService,
    private readonly mapper: ListingsMapper,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all listings (cursor-paginated, includes drafts)' })
  async list(@Query() query: AdminListListingsQuery) {
    const page = await this.listings.adminList(query);
    return { ...page, items: page.items.map((l) => this.mapper.adminListing(l)) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get listing by id (admin view)' })
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return this.mapper.adminListing(await this.listings.adminFindById(id));
  }

  @Post()
  @ApiOperation({ summary: 'Create a new listing in draft' })
  async create(@Body() dto: CreateListingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.mapper.adminListing(await this.listings.create(dto, user));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update listing (requires `version` for optimistic locking)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateListingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.mapper.adminListing(await this.listings.update(id, dto, user));
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('admin')
  @ApiOperation({ summary: 'Soft-delete a listing' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.listings.softDelete(id, user);
  }

  @Post(':id/publish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Transition listing to `published`' })
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.mapper.adminListing(
      await this.listings.transition(id, 'publish', dto.version, user),
    );
  }

  @Post(':id/archive')
  @HttpCode(200)
  @ApiOperation({ summary: 'Transition listing to `archived`' })
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.mapper.adminListing(
      await this.listings.transition(id, 'archive', dto.version, user),
    );
  }

  @Post(':id/mark-sold')
  @HttpCode(200)
  @ApiOperation({ summary: 'Transition listing to `sold` (records sale price + commission)' })
  async markSold(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.mapper.adminListing(
      await this.listings.transition(id, 'mark-sold', dto.version, user, {
        salePriceAmount: dto.salePriceAmount,
      }),
    );
  }

  @Post(':id/reserve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Transition listing to `reserved` (manual toggle, v1)' })
  async reserve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.mapper.adminListing(
      await this.listings.transition(id, 'reserve', dto.version, user),
    );
  }

  @Post(':id/unreserve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Transition reserved listing back to `published`' })
  async unreserve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.mapper.adminListing(
      await this.listings.transition(id, 'unreserve', dto.version, user),
    );
  }
}
