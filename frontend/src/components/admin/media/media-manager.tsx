'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { adminApi, type AdminMedia } from '@/lib/api/admin';
import { ApiClientError } from '@/lib/api/client';
import { fetchAccessToken } from '@/lib/auth/use-access-token';
import { Banner } from '@/components/admin/ui/banner';
import { Dialog } from '@/components/admin/ui/dialog';
import { MediaTile } from './media-tile';
import { PhotoAiWorkspace } from './photo-ai/photo-ai-workspace';
import {
  ACCEPT_ATTR,
  ACCEPTED_TYPES,
  MAX_FILE_MB,
  moveItem,
  validateFile,
  type MediaTileState,
} from './media-types';

interface MediaManagerProps {
  listingId: string;
  initial: AdminMedia[];
  readOnly?: boolean;
}

const POLL_MS = 4000;
/** ~10 min: a rendition job that hasn't resolved by then is considered dead. */
const POLL_MAX_TICKS = 150;

function tileFromServer(m: AdminMedia): MediaTileState {
  return {
    key: m.id,
    mediaId: m.id,
    type: m.type ?? 'image',
    phase: m.status === 'ready' ? 'ready' : m.status === 'failed' ? 'failed' : 'processing',
    progress: 100,
    isCover: m.isCover ?? false,
    previewUrl: m.thumbUrl ?? null,
    // An already-uploaded image can be reprocessed server-side (videos can't).
    canRetry: m.status === 'failed' && (m.type ?? 'image') === 'image',
    failureReason: m.failureReason ?? null,
  };
}

/**
 * Handoff 1e: dropzone (drag&drop + picker) with type/size validation,
 * tile grid with upload progress / processing / failed+retry states,
 * cover star, drag-to-reorder (pointer events → works on touch) with a
 * keyboard fallback on the handle, and delete.
 *
 * Upload pipeline per file: presign → XHR PUT (progress) → confirm →
 * poll listing until renditions are done.
 */
export function MediaManager({ listingId, initial, readOnly = false }: MediaManagerProps) {
  const t = useTranslations('admin.media');
  const tc = useTranslations('admin.common');
  const [tiles, setTiles] = useState<MediaTileState[]>(() => initial.map(tileFromServer));
  const [rejections, setRejections] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);
  const dragRef = useRef<{ from: number; over: number } | null>(null);
  const [toDelete, setToDelete] = useState<MediaTileState | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [photoAiId, setPhotoAiId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const tilesRef = useRef(tiles);
  tilesRef.current = tiles;

  // Revoke object URLs on unmount (they leak otherwise).
  useEffect(() => {
    return () => {
      for (const tile of tilesRef.current) {
        if (tile.previewUrl) URL.revokeObjectURL(tile.previewUrl);
      }
    };
  }, []);

  const patchTile = useCallback((key: string, patch: Partial<MediaTileState>) => {
    setTiles((prev) => prev.map((tile) => (tile.key === key ? { ...tile, ...patch } : tile)));
  }, []);

  /* ---------------- upload pipeline ---------------- */

  const upload = useCallback(
    async (key: string, file: File) => {
      try {
        const token = await fetchAccessToken();
        if (!token) {
          setError(tc('sessionExpired'));
          patchTile(key, { phase: 'failed', canRetry: true });
          return;
        }
        const presign = await adminApi.beginMediaUpload(
          listingId,
          {
            type: ACCEPTED_TYPES[file.type] ?? 'image',
            contentType: file.type,
            filename: file.name,
            sizeBytes: file.size,
          },
          { accessToken: token },
        );
        patchTile(key, { mediaId: presign.mediaId });

        await putWithProgress(presign.uploadUrl, file, (pct) => patchTile(key, { progress: pct }));

        const confirmToken = await fetchAccessToken();
        if (!confirmToken) {
          setError(tc('sessionExpired'));
          patchTile(key, { phase: 'failed', canRetry: true });
          return;
        }
        const confirmed = await adminApi.confirmMedia(presign.mediaId, {
          accessToken: confirmToken,
        });
        patchTile(key, {
          phase: confirmed.status === 'ready' ? 'ready' : 'processing',
          progress: 100,
        });
      } catch (e) {
        if (e instanceof ApiClientError && e.status === 429) setError(tc('rateLimited'));
        patchTile(key, { phase: 'failed', canRetry: true });
      }
    },
    [listingId, patchTile, tc],
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const rejected: string[] = [];
      const accepted: MediaTileState[] = [];
      for (const file of Array.from(files)) {
        const rejection = validateFile(file);
        if (rejection) {
          rejected.push(
            rejection.reason === 'type'
              ? t('errType', { name: rejection.name })
              : t('errSize', { name: rejection.name, size: MAX_FILE_MB }),
          );
          continue;
        }
        accepted.push({
          key: `local-${crypto.randomUUID()}`,
          mediaId: null,
          type: ACCEPTED_TYPES[file.type],
          phase: 'uploading',
          progress: 0,
          isCover: false,
          previewUrl: URL.createObjectURL(file),
          file,
          canRetry: false,
        });
      }
      setRejections(rejected);
      if (accepted.length) {
        setTiles((prev) => [...prev, ...accepted]);
        for (const tile of accepted) void upload(tile.key, tile.file!);
      }
    },
    [t, upload],
  );

  /* ------------- processing poll: server renditions ------------- */

  const processing = tiles.some((tile) => tile.phase === 'processing' && tile.mediaId);
  useEffect(() => {
    if (!processing) return;
    let ticks = 0;
    const id = setInterval(async () => {
      // Don't burn requests while the tab is in the background.
      if (document.visibilityState === 'hidden') return;
      ticks += 1;
      if (ticks > POLL_MAX_TICKS) {
        // Backend job is presumed dead — surface it instead of spinning forever.
        setTiles((prev) =>
          prev.map((tile) =>
            tile.phase === 'processing' ? { ...tile, phase: 'failed', canRetry: false } : tile,
          ),
        );
        return;
      }
      try {
        const token = await fetchAccessToken();
        if (!token) return;
        const fresh = await adminApi.getListing(listingId, { accessToken: token });
        const freshById = new Map((fresh.media ?? []).map((m) => [m.id, m]));
        setTiles((prev) =>
          prev.map((tile) => {
            if (!tile.mediaId || tile.phase !== 'processing') return tile;
            const media = freshById.get(tile.mediaId);
            if (media?.status === 'ready') {
              // Keep the local blob preview when we have one; otherwise switch
              // to the freshly generated server thumb.
              return {
                ...tile,
                phase: 'ready',
                previewUrl: tile.previewUrl ?? media.thumbUrl ?? null,
              };
            }
            if (media?.status === 'failed') {
              // Uploaded-but-failed image → offer a server-side reprocess.
              return {
                ...tile,
                phase: 'failed',
                canRetry: tile.type === 'image' && Boolean(tile.mediaId),
                failureReason: media.failureReason ?? null,
              };
            }
            return tile;
          }),
        );
      } catch {
        // Poll is best-effort; next tick retries.
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [processing, listingId]);

  /* ---------------- server mutations ---------------- */

  const withToken = async (fn: (token: string) => Promise<void>) => {
    setError(null);
    try {
      const token = await fetchAccessToken();
      if (!token) {
        setError(tc('sessionExpired'));
        return;
      }
      await fn(token);
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 429) setError(tc('rateLimited'));
      else if (e instanceof ApiClientError) setError(e.message);
      else setError(tc('errorTitle'));
    }
  };

  const makeCover = (tile: MediaTileState) => {
    if (!tile.mediaId) return;
    const id = tile.mediaId;
    void withToken(async (token) => {
      await adminApi.setCoverMedia(listingId, id, { accessToken: token });
      setTiles((prev) => prev.map((x) => ({ ...x, isCover: x.key === tile.key })));
    });
  };

  const persistOrder = (ordered: MediaTileState[]) => {
    const ids = ordered.map((x) => x.mediaId).filter((id): id is string => Boolean(id));
    if (ids.length < 2) return;
    void withToken(async (token) => {
      await adminApi.reorderMedia(listingId, ids, { accessToken: token });
    });
  };

  const confirmDelete = async () => {
    if (!toDelete || deleting) return;
    // Local-only failed tile (upload never confirmed) — just drop it.
    if (!toDelete.mediaId) {
      if (toDelete.previewUrl) URL.revokeObjectURL(toDelete.previewUrl);
      setTiles((prev) => prev.filter((x) => x.key !== toDelete.key));
      setToDelete(null);
      return;
    }
    setDeleting(true);
    const target = toDelete;
    await withToken(async (token) => {
      await adminApi.deleteMedia(target.mediaId!, { accessToken: token });
      if (target.previewUrl) URL.revokeObjectURL(target.previewUrl);
      setTiles((prev) => prev.filter((x) => x.key !== target.key));
      // Close only on success — on failure the dialog stays open with the
      // error banner so the user can retry or cancel deliberately.
      setToDelete(null);
    });
    setDeleting(false);
  };

  const retry = (tile: MediaTileState) => {
    // A local file that never confirmed → re-run the whole upload pipeline.
    if (tile.file) {
      patchTile(tile.key, { phase: 'uploading', progress: 0, canRetry: false });
      void upload(tile.key, tile.file);
      return;
    }
    // Already uploaded but processing failed → ask the backend to reprocess.
    if (!tile.mediaId) return;
    const id = tile.mediaId;
    patchTile(tile.key, { phase: 'processing', canRetry: false, failureReason: null });
    void withToken(async (token) => {
      try {
        await adminApi.retryMedia(id, { accessToken: token });
      } catch (e) {
        patchTile(tile.key, { phase: 'failed', canRetry: true });
        throw e;
      }
    });
  };

  /* ---------------- reorder: pointer drag + keyboard ---------------- */

  const startReorder = (from: number) => {
    dragRef.current = { from, over: from };
    setDrag(dragRef.current);
  };

  const moveReorder = (point: { x: number; y: number }) => {
    const current = dragRef.current;
    if (!current) return;
    const target = document
      .elementsFromPoint(point.x - window.scrollX, point.y - window.scrollY)
      .find(
        (node) =>
          node instanceof HTMLElement &&
          gridRef.current?.contains(node) &&
          node.dataset.mediaTile !== undefined &&
          Number(node.dataset.mediaTile) !== current.from,
      );
    const over = target instanceof HTMLElement ? Number(target.dataset.mediaTile) : current.from;
    if (over === current.over) return;
    dragRef.current = { ...current, over };
    setDrag(dragRef.current);
  };

  const endReorder = (cancelled: boolean) => {
    const current = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (cancelled || !current || current.from === current.over) return;
    const next = moveItem(tilesRef.current, current.from, current.over);
    setTiles(next);
    persistOrder(next);
  };

  const onHandleKeyDown = (index: number) => (e: React.KeyboardEvent) => {
    const delta = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (!delta) return;
    e.preventDefault();
    const destination = Math.max(0, Math.min(tilesRef.current.length - 1, index + delta));
    if (destination === index) return;
    const next = moveItem(tilesRef.current, index, destination);
    setTiles(next);
    persistOrder(next);
    // Keep focus on the moved tile's handle after re-render.
    requestAnimationFrame(() => {
      gridRef.current
        ?.querySelector<HTMLElement>(
          `[data-media-tile="${destination}"] button[aria-label="${t('dragHandle')}"]`,
        )
        ?.focus();
    });
  };

  /* ---------------- render ---------------- */
  if (readOnly)
    return (
      <div>
        <Banner tone="info" className="mb-3">
          Продане оголошення доступне лише для перегляду.
        </Banner>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {initial.map((item) => (
            <div key={item.id} className="aspect-[4/3] overflow-hidden bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element -- stored thumbnail */}
              {item.thumbUrl ? (
                <img
                  src={item.thumbUrl}
                  alt="Фото проданого авто"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>Фото</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-[0.75rem] font-medium text-ink-3">{t('reorderHint')}</span>
      </div>

      {error && (
        <Banner tone="error" className="mb-3">
          {error}
        </Banner>
      )}
      {rejections.length > 0 && (
        <Banner tone="error" className="mb-3">
          {rejections.join(' · ')}
        </Banner>
      )}

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          'mb-[18px] rounded-none border-2 border-dashed px-5 py-[22px] text-center transition-colors',
          dragOver ? 'border-accent bg-accent/[0.08]' : 'border-accent/30 bg-accent/[0.04]',
        )}
      >
        <div aria-hidden className="mb-1.5 text-[1.5rem] leading-none text-accent">
          ⬆
        </div>
        <p className="text-[0.84375rem] font-medium text-accent-hover">
          {t('dropText')}{' '}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="focus-ring rounded-none underline"
          >
            {t('browse')}
          </button>
        </p>
        <p className="mt-1 text-[0.71875rem] font-medium text-ink-3">
          {t('dropHint', { size: MAX_FILE_MB })}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="sr-only"
          aria-label={t('browse')}
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Tile grid */}
      <div ref={gridRef} className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {tiles.map((tile, i) => (
          <MediaTile
            key={tile.key}
            tile={tile}
            index={i}
            isDropTarget={drag !== null && drag.over === i && drag.from !== i}
            isDragging={drag !== null && drag.from === i}
            onPhotoAi={() => tile.mediaId && setPhotoAiId(tile.mediaId)}
            onMakeCover={() => makeCover(tile)}
            onDelete={() => setToDelete(tile)}
            onRetry={() => retry(tile)}
            onReorderStart={() => startReorder(i)}
            onReorderMove={moveReorder}
            onReorderEnd={endReorder}
            onHandleKeyDown={onHandleKeyDown(i)}
          />
        ))}
        {/* trailing "+" ghost cell opens the picker */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label={t('browse')}
          className="focus-ring flex h-32 items-center justify-center rounded-none border-2 border-dashed border-line-strong text-[1.375rem] text-ph-glyph hover:border-line-hover hover:text-ink-3"
        >
          +
        </button>
      </div>

      {photoAiId && (
        <PhotoAiWorkspace
          mediaId={photoAiId}
          onClose={() => setPhotoAiId(null)}
          onApplied={async () => {
            const token = await fetchAccessToken();
            if (!token) throw new Error(tc('sessionExpired'));
            const listing = await adminApi.getListing(listingId, { accessToken: token });
            setTiles((prev) =>
              prev.map((tile) => {
                const media = listing.media?.find((m) => m.id === tile.mediaId);
                return media ? { ...tile, previewUrl: media.thumbUrl ?? tile.previewUrl } : tile;
              }),
            );
          }}
        />
      )}

      <Dialog
        open={toDelete !== null}
        onClose={() => (deleting ? null : setToDelete(null))}
        title={t('deleteTitle')}
        footer={
          <>
            <button
              type="button"
              onClick={() => setToDelete(null)}
              disabled={deleting}
              className="focus-ring h-10 rounded-none border border-line-input bg-surface px-4 text-[0.8125rem] font-medium text-ink"
            >
              {tc('cancel')}
            </button>
            <button
              type="button"
              onClick={() => void confirmDelete()}
              disabled={deleting}
              className="focus-ring h-10 rounded-none platform-destructive px-4 text-[0.8125rem] font-medium disabled:opacity-60"
            >
              {deleting ? tc('saving') : tc('delete')}
            </button>
          </>
        }
      >
        <p className="text-[0.84375rem] font-medium leading-relaxed text-ink-2">
          {t('deleteBody')}
        </p>
        {error && (
          <Banner tone="error" className="mt-3">
            {error}
          </Banner>
        )}
      </Dialog>
    </div>
  );
}

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`upload failed: ${xhr.status}`));
    xhr.onerror = () => reject(new Error('upload network error'));
    xhr.send(file);
  });
}
