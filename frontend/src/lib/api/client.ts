import type { ApiError } from './types';

const BACKEND_INTERNAL = process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:3000/api';
const BACKEND_PUBLIC = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000/api';

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly payload: ApiError,
  ) {
    super(Array.isArray(payload.message) ? payload.message.join('; ') : payload.message);
    this.name = 'ApiClientError';
  }
}

interface FetchOptions extends Omit<RequestInit, 'body'> {
  query?: Record<string, string | number | boolean | string[] | undefined | null>;
  body?: unknown;
  /** Bearer token (admin). */
  accessToken?: string;
  /** Next.js fetch cache opts — only honoured on the server. */
  next?: { revalidate?: number; tags?: string[] };
}

/**
 * Server-side requests reach the backend through `BACKEND_INTERNAL_URL` (the
 * docker-network hostname in prod). Client-side requests use
 * `NEXT_PUBLIC_BACKEND_URL`.
 */
function buildUrl(path: string, query?: FetchOptions['query']): string {
  const base = typeof window === 'undefined' ? BACKEND_INTERNAL : BACKEND_PUBLIC;
  const url = new URL(path.startsWith('/') ? path.slice(1) : path, ensureSlash(base));
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        for (const v of value) url.searchParams.append(`${key}[]`, String(v));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

function ensureSlash(s: string): string {
  return s.endsWith('/') ? s : `${s}/`;
}

export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { query, body, headers, accessToken, next, ...rest } = opts;
  const url = buildUrl(path, query);

  const merged: HeadersInit = {
    accept: 'application/json',
    ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    ...(headers ?? {}),
  };

  const res = await fetch(url, {
    ...rest,
    headers: merged,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    next: typeof window === 'undefined' ? next : undefined,
  });

  if (!res.ok) {
    let payload: ApiError;
    try {
      payload = (await res.json()) as ApiError;
    } catch {
      payload = {
        statusCode: res.status,
        error: res.statusText,
        message: res.statusText,
      };
    }
    throw new ApiClientError(res.status, payload);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
