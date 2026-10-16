import { config as loadDotenv } from 'dotenv';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { validateEnv } from '../../config/env.validation';
import { adminDataSourceOptions } from '../../database/data-source';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { extendAccount } from './billing-account.store';
import { buildBillingSettings, seedPaidUntil } from './billing.config';

/**
 * Operator tool: extend the paid period by hand (e.g. the client paid by bank
 * transfer). Same locking + extension rule as a Monobank credit.
 *
 *   npm run billing:extend -- <months>          (dev, ts-node)
 *   npm run billing:extend:prod -- <months>     (compiled, inside the app image)
 *
 * Running instances pick the new date up within their 15s status cache.
 */

loadDotenv();

const MAX_MONTHS = 36;

function parseMonths(arg: string | undefined): number {
  const months = Number(arg);
  if (!Number.isInteger(months) || months < 1 || months > MAX_MONTHS) {
    throw new Error(`Usage: billing:extend -- <months 1..${MAX_MONTHS}>`);
  }
  return months;
}

async function main(): Promise<void> {
  const months = parseMonths(process.argv[2]);
  const settings = buildBillingSettings(validateEnv(process.env));
  const now = new Date();
  const seed = seedPaidUntil(settings, now);

  const ds = new DataSource(adminDataSourceOptions);
  await ds.initialize();
  try {
    const change = await ds.transaction(async (em) => {
      const result = await extendAccount(em, months, now, seed);
      await em.getRepository(AuditLog).insert({
        actorId: null,
        actorRole: 'cli',
        action: 'billing.extended_manually',
        entityType: 'billing',
        entityId: null,
        diff: {
          months,
          paidUntilBefore: result.before.toISOString(),
          paidUntilAfter: result.after.toISOString(),
        },
        correlationId: null,
      });
      return result;
    });
    process.stdout.write(
      `Paid until: ${change.before.toISOString()} -> ${change.after.toISOString()}\n`,
    );
  } finally {
    await ds.destroy();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
