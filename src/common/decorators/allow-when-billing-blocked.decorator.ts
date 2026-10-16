import { SetMetadata } from '@nestjs/common';

export const ALLOW_WHEN_BILLING_BLOCKED_KEY = 'allowWhenBillingBlocked';

/**
 * Marks an authenticated route that must keep working while the hosting
 * subscription is blocked (the billing page itself, `GET /auth/me`).
 */
export const AllowWhenBillingBlocked = () => SetMetadata(ALLOW_WHEN_BILLING_BLOCKED_KEY, true);
