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
import {
  CreatePlacementPackageDto,
  UpdatePlacementPackageDto,
} from './dto/upsert-placement-package.dto';
import { PlacementPackagesService } from './placement-packages.service';

@ApiTags('admin:placement-packages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
// Prices are a business decision: admin-only, editors stay on listings + leads.
@Roles('admin')
@Controller('admin/placement-packages')
export class PlacementPackagesAdminController {
  constructor(private readonly packages: PlacementPackagesService) {}

  @Get()
  @ApiOperation({ summary: 'All placement packages including hidden ones' })
  list() {
    return this.packages.listAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a placement package' })
  create(@Body() dto: CreatePlacementPackageDto, @CurrentUser() user: AuthenticatedUser) {
    return this.packages.create(dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a placement package' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlacementPackageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.packages.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete a placement package' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.packages.remove(id, user);
  }
}
