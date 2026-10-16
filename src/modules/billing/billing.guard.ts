import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_WHEN_BILLING_BLOCKED_KEY } from '../../common/decorators/allow-when-billing-blocked.decorator';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { BillingService } from './billing.service';

export const BILLING_BLOCKED_MESSAGE =
  'Обслуговування сайту не оплачено. Панель керування тимчасово недоступна.';

/**
 * Global guard (after JwtAuthGuard/RolesGuard): once the subscription is
 * blocked, every authenticated route answers 402 except the ones marked
 * @AllowWhenBillingBlocked. Public storefront routes are never affected.
 */
@Injectable()
export class BillingGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly billing: BillingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.billing.isEnabled) return true;
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_WHEN_BILLING_BLOCKED_KEY, targets)) {
      return true;
    }
    if (!(await this.billing.isBlocked())) return true;
    throw new HttpException(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        error: 'BillingBlocked',
        message: BILLING_BLOCKED_MESSAGE,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
