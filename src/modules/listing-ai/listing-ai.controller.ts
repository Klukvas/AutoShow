import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AcceptListingAiDraftDto, CreateListingAiDraftDto } from './listing-ai.dto';
import { ListingAiService } from './listing-ai.service';
import { draftView } from './listing-ai.views';

@Controller('admin/listings/:id/ai-description')
@ApiTags('admin:listing-ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'editor')
export class ListingAiController {
  constructor(private readonly drafts: ListingAiService) {}

  @Get()
  workspace(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.drafts.workspace(id, actor);
  }

  @Post()
  @HttpCode(202)
  @Throttle({ global: { limit: 10, ttl: 60_000 } })
  async create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateListingAiDraftDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return draftView(await this.drafts.create(id, dto, actor), null);
  }

  @Get(':generationId')
  draft(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('generationId', ParseUUIDPipe) generationId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.drafts.draft(id, generationId, actor);
  }

  @Post(':generationId/accept')
  @HttpCode(200)
  accept(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('generationId', ParseUUIDPipe) generationId: string,
    @Body() dto: AcceptListingAiDraftDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.drafts.accept(id, generationId, dto, actor);
  }
}
