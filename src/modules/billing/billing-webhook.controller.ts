import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  ServiceUnavailableException,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { BillingService } from './billing.service';
import { MonobankApiError, MonobankClient } from './monobank.client';
import { parseWebhookInvoiceId } from './monobank.types';

/**
 * Monobank acquiring webhook. Public (Monobank has no bearer token), so trust
 * comes only from the ECDSA `X-Sign` over the raw body — and even a valid
 * webhook is just a hint: the status API is re-read before anything is credited.
 */
@ApiExcludeController()
@Controller('billing/monobank')
export class BillingWebhookController {
  constructor(
    private readonly billing: BillingService,
    private readonly monobank: MonobankClient,
  ) {}

  @Public()
  // Relaxed (not skipped): Monobank retries share a few IPs, floods still get cut.
  @Throttle({ global: { limit: 600, ttl: 60_000 } })
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-sign') signature: string | undefined,
  ): Promise<{ ok: true }> {
    if (!this.billing.isEnabled) return { ok: true };
    const rawBody = req.rawBody;
    if (!rawBody?.length || !signature) throw new BadRequestException('Invalid signature');

    let isValid: boolean;
    try {
      isValid = await this.monobank.verifyWebhook(rawBody, signature);
    } catch (err) {
      if (err instanceof MonobankApiError) throw new ServiceUnavailableException();
      throw err;
    }
    if (!isValid) throw new BadRequestException('Invalid signature');

    const invoiceId = parseWebhookInvoiceId(rawBody);
    if (!invoiceId) return { ok: true };
    await this.billing.handleWebhook(invoiceId);
    return { ok: true };
  }
}
