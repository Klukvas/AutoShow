/**
 * Audit row presentation model (handoff 1i): backend action codes →
 * i18n key + glyph + tone. Pure/unit-testable; copy stays in messages.
 */

export interface AuditRow {
  id: string;
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  createdAt: string;
}

export interface AuditPresentation {
  /** admin.audit.action.<key> */
  labelKey: string;
  glyph: string;
  tone: 'accent' | 'success' | 'danger' | 'warning' | 'neutral';
}

const MAP: Record<string, AuditPresentation> = {
  'listing.create': { labelKey: 'listing_create', glyph: '＋', tone: 'success' },
  'listing.update': { labelKey: 'listing_update', glyph: '✎', tone: 'accent' },
  'listing.delete': { labelKey: 'listing_delete', glyph: '✕', tone: 'danger' },
  'listing.publish': { labelKey: 'listing_publish', glyph: '✎', tone: 'accent' },
  'listing.archive': { labelKey: 'listing_archive', glyph: '◍', tone: 'neutral' },
  'listing.mark-sold': { labelKey: 'listing_mark_sold', glyph: '◍', tone: 'danger' },
  'listing.reserve': { labelKey: 'listing_reserve', glyph: '◍', tone: 'warning' },
  'listing.unreserve': { labelKey: 'listing_unreserve', glyph: '◍', tone: 'warning' },
  'media.confirm': { labelKey: 'media_confirm', glyph: '🖼', tone: 'neutral' },
  'media.delete': { labelKey: 'media_delete', glyph: '🖼', tone: 'danger' },
  'media.reorder': { labelKey: 'media_reorder', glyph: '🖼', tone: 'neutral' },
  'media.set_cover': { labelKey: 'media_set_cover', glyph: '🖼', tone: 'accent' },
  'admin_user.create': { labelKey: 'admin_user_create', glyph: '＋', tone: 'success' },
  'admin_user.update': { labelKey: 'admin_user_update', glyph: '◍', tone: 'neutral' },
  'admin_user.delete': { labelKey: 'admin_user_delete', glyph: '✕', tone: 'danger' },
  'branding.update': { labelKey: 'branding_update', glyph: '✎', tone: 'accent' },
  'lead.status_change': { labelKey: 'lead_status_change', glyph: '✉', tone: 'neutral' },
};

export function presentAuditAction(action: string): AuditPresentation {
  return MAP[action] ?? { labelKey: 'fallback', glyph: '◍', tone: 'neutral' };
}

/** Server-side filter options — the backend filters by entityType exactly. */
export const AUDIT_ENTITY_TYPES = [
  'listing',
  'listing_media',
  'admin_user',
  'site_settings',
  'lead',
] as const;

export type AuditPeriod = '7' | '30' | 'all';

/**
 * Period cut applied to a DESC-ordered page: rows are sorted newest-first,
 * so the first out-of-range row ends the visible window — everything after
 * it is older. When we cut, pagination past the cut is meaningless, so the
 * caller must drop nextCursor (truncated=true).
 */
export function sliceByPeriod<T extends { createdAt: string }>(
  items: T[],
  period: AuditPeriod,
  now: Date = new Date(),
): { items: T[]; truncated: boolean } {
  if (period === 'all') return { items, truncated: false };
  const days = Number(period);
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  const idx = items.findIndex((row) => new Date(row.createdAt).getTime() < cutoff);
  if (idx === -1) return { items, truncated: false };
  return { items: items.slice(0, idx), truncated: true };
}

/** Short human handle for an entity id: `#a1b2c3d4`. */
export function shortId(id: string | null | undefined): string {
  return id ? `#${id.slice(0, 8)}` : '';
}
