import { ConflictException } from '@nestjs/common';

const PG_UNIQUE_VIOLATION = '23505';

interface PostgresError {
  code?: string;
  detail?: string;
  constraint?: string;
}

/**
 * Wrap a write that may race against another writer producing the same
 * partial-unique key (slug, email, …). Postgres surfaces these
 * as error code 23505; without this wrapper TypeORM rethrows them as
 * `QueryFailedError` → the exception filter renders 500 instead of 409.
 */
export async function catchUniqueViolation<T>(fn: () => Promise<T>, message: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const pg = err as PostgresError;
    if (pg?.code === PG_UNIQUE_VIOLATION) {
      throw new ConflictException(message);
    }
    throw err;
  }
}
