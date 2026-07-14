export interface CursorPayload {
  /** ISO timestamp of the sort key (published_at, price_normalized, etc.). */
  k: string;
  /** Tiebreaker id (UUID). */
  i: string;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as CursorPayload;
    if (typeof parsed.k !== 'string' || typeof parsed.i !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  /** Total rows matching the filters (independent of the cursor window). */
  total?: number;
}
