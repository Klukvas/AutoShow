'use client';

/* eslint-disable @next/next/no-img-element -- object-URL previews of local
   uploads can't go through next/image */

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { CarThumb } from '@/components/admin/ui/car-thumb';
import type { MediaTileState } from './media-types';

interface MediaTileProps {
  tile: MediaTileState;
  index: number;
  isDropTarget: boolean;
  isDragging: boolean;
  onMakeCover: () => void;
  onDelete: () => void;
  onRetry: () => void;
  onHandlePointerDown: (e: React.PointerEvent) => void;
  onHandleKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * One media cell (handoff 1e): preview (or intentional placeholder),
 * status overlays (uploading % / processing spinner / ready / failed+retry),
 * cover star + accent border, drag handle, delete.
 */
export function MediaTile({
  tile,
  index,
  isDropTarget,
  isDragging,
  onMakeCover,
  onDelete,
  onRetry,
  onHandlePointerDown,
  onHandleKeyDown,
}: MediaTileProps) {
  const t = useTranslations('admin.media');
  const interactive = tile.phase === 'ready';

  return (
    <div
      data-media-tile={index}
      className={cn(
        'relative h-24 select-none overflow-hidden rounded-[10px] border bg-ph-a',
        tile.isCover ? 'border-2 border-accent' : 'border-line-strong/60',
        isDropTarget && 'ring-2 ring-focus ring-offset-2 ring-offset-bg',
        isDragging && 'opacity-60',
      )}
      role="group"
      aria-label={`${t('tile', { index: index + 1 })}${tile.isCover ? ` · ${t('cover')}` : ''}`}
    >
      {/* Preview */}
      {tile.previewUrl ? (
        <img
          src={tile.previewUrl}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <CarThumb className="absolute inset-0 h-full w-full" />
      )}
      {tile.type === 'video' && tile.phase === 'ready' && (
        <span className="absolute bottom-1.5 right-1.5 rounded-[5px] bg-[rgba(20,22,27,0.7)] px-[7px] py-[2px] text-[9px] font-bold text-white">
          {t('video')}
        </span>
      )}

      {/* Cover badge / make-cover star */}
      {tile.isCover ? (
        <span className="absolute left-1.5 top-1.5 rounded-[5px] bg-accent px-[7px] py-[2px] text-[9.5px] font-bold text-on-accent">
          ★ {t('cover')}
        </span>
      ) : (
        interactive && (
          <button
            type="button"
            aria-label={t('makeCover')}
            title={t('makeCover')}
            onClick={onMakeCover}
            className="focus-ring absolute left-1.5 top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-[6px] bg-[rgba(255,255,255,0.9)] text-[12px] text-ink-2 hover:text-accent"
          >
            ★
          </button>
        )
      )}

      {/* Drag handle (pointer + keyboard reorder) */}
      {interactive && (
        <button
          type="button"
          aria-label={t('dragHandle')}
          title={t('dragHandle')}
          onPointerDown={onHandlePointerDown}
          onKeyDown={onHandleKeyDown}
          className="focus-ring absolute right-1.5 top-1.5 flex h-[22px] w-[22px] touch-none items-center justify-center rounded-[6px] bg-[rgba(255,255,255,0.9)] text-[11px] text-ink-2"
        >
          ⠿
        </button>
      )}

      {/* Delete */}
      {(interactive || tile.phase === 'failed') && (
        <button
          type="button"
          aria-label={t('deleteFile')}
          title={t('deleteFile')}
          onClick={onDelete}
          className={cn(
            'focus-ring absolute flex h-[22px] w-[22px] items-center justify-center rounded-[6px] bg-[rgba(255,255,255,0.9)] text-danger',
            interactive ? 'bottom-1.5 left-1.5' : 'right-1.5 top-1.5',
          )}
        >
          <svg viewBox="0 0 12 13" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.3">
            <path d="M1 3h10M4.5 3V1.5h3V3M2.5 3l.6 8h5.8l.6-8M4.8 5.5v3.5M7.2 5.5v3.5" />
          </svg>
        </button>
      )}

      {/* Status overlays */}
      {tile.phase === 'ready' && !tile.isCover && (
        <span className="absolute bottom-1.5 left-1.5 rounded-[5px] bg-[rgba(31,157,87,0.92)] px-[7px] py-[2px] text-[9px] font-bold text-white group-hover:opacity-0">
          ✓ {t('statusReady')}
        </span>
      )}

      {tile.phase === 'uploading' && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-2/95 px-3"
          aria-live="polite"
        >
          <span className="font-heading text-[13px] font-bold text-accent tabular">
            {Math.round(tile.progress)}%
          </span>
          <div
            role="progressbar"
            aria-valuenow={Math.round(tile.progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('statusUploading', { percent: Math.round(tile.progress) })}
            className="h-[5px] w-full overflow-hidden rounded-[5px] bg-line-input"
          >
            <div className="h-full bg-accent" style={{ width: `${tile.progress}%` }} />
          </div>
        </div>
      )}

      {tile.phase === 'processing' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[7px] bg-surface-2/95">
          <span
            aria-hidden
            className="h-5 w-5 animate-spin rounded-full border-[2.5px] border-accent/25 border-t-accent motion-reduce:animate-none"
          />
          <span className="text-[10px] font-semibold text-ink-3">{t('statusProcessing')}</span>
        </div>
      )}

      {tile.phase === 'failed' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 border border-danger-line bg-danger-bg">
          <span aria-hidden className="text-[15px] leading-none text-danger">
            ✕
          </span>
          <span className="text-[10px] font-semibold text-danger">{t('statusFailed')}</span>
          {tile.canRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="focus-ring rounded-[4px] text-[9.5px] font-bold text-accent hover:text-accent-hover"
            >
              {t('retry')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
