import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { LeadStatus } from './entities/lead.entity';
import { LeadsService } from './leads.service';

class ListLeadsQuery {
  @IsOptional()
  @IsEnum({ new: 'new', in_progress: 'in_progress', done: 'done', spam: 'spam' })
  status?: LeadStatus;

  @IsOptional() @IsString() cursor?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

class UpdateLeadStatusDto {
  @IsEnum({ new: 'new', in_progress: 'in_progress', done: 'done', spam: 'spam' })
  status!: LeadStatus;
}

@ApiTags('admin:leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'editor')
@Controller('admin/leads')
export class LeadsAdminController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  @ApiOperation({ summary: 'List leads (cursor-paginated)' })
  list(@Query() q: ListLeadsQuery) {
    return this.leads.list({ status: q.status, cursor: q.cursor, limit: q.limit });
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change lead status' })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leads.updateStatus(id, dto.status, user);
  }
}
