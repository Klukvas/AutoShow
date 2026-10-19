import { apiFetch } from '../api/client';
import { fetchAccessToken } from '../auth/use-access-token';

/** Authenticated admin API call; never cached. */
export async function adminCall<T>(
  path: string,
  body?: unknown,
  method?: 'GET' | 'POST' | 'PATCH',
): Promise<T> {
  const accessToken = await fetchAccessToken();
  if (!accessToken) throw new Error('Сесія закінчилася. Увійдіть знову.');
  return apiFetch<T>(path, {
    accessToken,
    cache: 'no-store',
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    body,
  });
}
