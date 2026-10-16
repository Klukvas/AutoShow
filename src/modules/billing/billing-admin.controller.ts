import { BadRequestException, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AllowWhenBillingBlocked } from '../../common/decorators/allow-when-billing-blocked.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { BillingService } from './billing.service';
import { isValidInvoiceId } from './monobank.types';

/** The only admin API that stays reachable while the subscription is blocked. */
@ApiTags('admin:billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@AllowWhenBillingBlocked()
@Controller('admin/billing')
export class BillingAdminController {
  constructor(private readonly billing: BillingService) {}

  @Get('status')
  @Roles('admin', 'editor')
  @ApiOperation({ summary: 'Subscription status (editors get only enabled/blocked)' })
  status(@CurrentUser() user: AuthenticatedUser) {
    return user.role === 'admin' ? this.billing.getAdminStatus() : this.billing.getEditorStatus();
  }

  @Get('invoices')
  @Roles('admin')
  @ApiOperation({ summary: 'Payment history' })
  invoices() {
    return this.billing.listInvoices();
  }

  @Post('invoices')
  @Roles('admin')
  @Throttle({ global: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create a Monobank invoice for one payment period' })
  create(@CurrentUser() user: AuthenticatedUser) {
    return this.billing.createInvoice(user);
  }

  @Post('invoices/:invoiceId/sync')
  @Roles('admin')
  @Throttle({ global: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Re-check an invoice with Monobank and credit it if paid' })
  sync(@Param('invoiceId') invoiceId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!isValidInvoiceId(invoiceId)) throw new BadRequestException('Некоректний номер рахунку');
    // Hosting only: photo packs have their own (non-allowlisted) endpoint.
    return this.billing.syncInvoice(invoiceId, user, 'hosting');
  }
}
