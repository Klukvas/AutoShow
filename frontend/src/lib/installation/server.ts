import { cache } from 'react';
import { apiFetch } from '@/lib/api/client';
import { installationSchema } from './config';

// Fail closed on unavailable/malformed controls rather than enabling a disabled
// operator feature through an old cached or invented default configuration.
export const getInstallation = cache(async () =>
  installationSchema.parse(await apiFetch<unknown>('/installation', { cache: 'no-store' })),
);
