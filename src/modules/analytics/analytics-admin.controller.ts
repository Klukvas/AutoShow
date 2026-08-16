import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AnalyticsService } from './analytics.service';

@ApiTags('admin:analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
// Dashboard exposes sales/commission figures — admin-only per the role policy
// (editors are scoped to listings + leads).
@Roles('admin')
@Controller('admin/analytics')
export class AnalyticsAdminController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Dashboard metrics: listings, sales, commissions, leads, views' })
  summary() {
    return this.analytics.summary();
  }
}
