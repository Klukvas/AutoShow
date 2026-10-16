import { BadRequestException, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { isValidInvoiceId } from './monobank.types';
import { PhotoPackService } from './photo-pack.service';

/**
 * Admin-only photo-AI packs. Deliberately NOT @AllowWhenBillingBlocked: while
 * hosting is unpaid the BillingGuard answers 402 — only hosting can be paid.
 */
@ApiTags('admin:photo-ai-credits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/photo-ai/credits')
export class PhotoPackController {
  constructor(private readonly packs: PhotoPackService) {}

  @Get()
  @ApiOperation({ summary: 'Photo balance, pack terms and purchase history' })
  overview() {
    return this.packs.overview();
  }

  @Post('packs')
  @Throttle({ global: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create a Monobank invoice for one photo pack' })
  buy(@CurrentUser() user: AuthenticatedUser) {
    return this.packs.buyPack(user);
  }

  @Post('packs/:invoiceId/sync')
  @Throttle({ global: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Re-check a photo-pack invoice with Monobank' })
  sync(@Param('invoiceId') invoiceId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!isValidInvoiceId(invoiceId)) throw new BadRequestException('Некоректний номер рахунку');
    return this.packs.sync(invoiceId, user);
  }
}
