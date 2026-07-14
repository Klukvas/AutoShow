export type MediaPhase = 'uploading' | 'processing' | 'ready' | 'failed';

export interface MediaTileState {
  /** Stable local key (server id when known, else a client key). */
  key: string;
  /** Backend media id — null until presign succeeds. */
  mediaId: string | null;
  type: 'image' | 'video';
  phase: MediaPhase;
  /** 0–100, meaningful while uploading. */
  progress: number;
  isCover: boolean;
  /** Object URL for freshly picked files; server media render a placeholder. */
  previewUrl: string | null;
  /** Kept for retry after a failed upload. */
  file?: File;
  canRetry: boolean;
}

export const MAX_FILE_MB = 20;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

export const ACCEPTED_TYPES: Record<string, 'image' | 'video'> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'video/mp4': 'video',
};

export const ACCEPT_ATTR = Object.keys(ACCEPTED_TYPES).join(',');

export type FileRejection = { name: string; reason: 'type' | 'size' };

/** Pure validation so it's unit-testable. */
export function validateFile(file: Pick<File, 'type' | 'size' | 'name'>): FileRejection | null {
  if (!ACCEPTED_TYPES[file.type]) return { name: file.name, reason: 'type' };
  if (file.size > MAX_FILE_BYTES) return { name: file.name, reason: 'size' };
  return null;
}

/** Move an array element (immutably) — reorder helper. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length) return [...items];
  const clamped = Math.max(0, Math.min(items.length - 1, to));
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(clamped, 0, moved);
  return next;
}
