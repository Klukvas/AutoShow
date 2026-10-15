'use client';

/* eslint-disable @next/next/no-img-element -- object-URL previews of local
   uploads can't go through next/image */

import {
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  type PanInfo,
} from 'framer-motion';
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
  onPhotoAi?: () => void;
  onDelete: () => void;
  onRetry: () => void;
  onReorderStart: () => void;
  onReorderMove: (point: PanInfo['point']) => void;
  onReorderEnd: (cancelled: boolean) => void;
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
  onPhotoAi,
  onDelete,
  onRetry,
  onReorderStart,
  onReorderMove,
  onReorderEnd,
  onHandleKeyDown,
}: MediaTileProps) {
  const t = useTranslations('admin.media');
  const interactive = tile.phase === 'ready';
  const reduce = useReducedMotion();
  const dragControls = useDragControls();
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const finishDrag = (cancelled: boolean) => {
    if (reduce) {
      x.jump(0);
      y.jump(0);
    }
    onReorderEnd(cancelled);
  };

  return (
    <motion.div
      // Reorders happen on drop/keyboard, so `layout` springs each tile into
      // its new grid slot instead of snapping (§6). The dragged tile isn't
      // layout-animated mid-gesture (reorder only fires on release).
      layout={reduce || isDragging ? false : 'position'}
      drag={interactive}
      dragListener={false}
      dragControls={dragControls}
      dragSnapToOrigin={!reduce}
      dragMomentum={false}
      dragTransition={{ bounceStiffness: 500, bounceDamping: 40 }}
      onDragStart={onReorderStart}
      onDrag={(_, info) => onReorderMove(info.point)}
      onDragEnd={(event) => finishDrag(event.type === 'pointercancel')}
      onPointerCancel={() => finishDrag(true)}
      style={{ x, y, zIndex: isDragging ? 10 : undefined }}
      transition={reduce ? { duration: 0 } : { type: 'spring', bounce: 0, duration: 0.35 }}
      data-media-tile={index}
      className={cn(
        'relative h-32 select-none overflow-hidden rounded-none border bg-ph-a',
        tile.isCover ? 'border-2 border-accent' : 'border-line-strong/60',
        isDropTarget && 'ring-2 ring-focus ring-offset-2 ring-offset-bg',
        isDragging && 'opacity-80 shadow-none',
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
        <span className="absolute bottom-1.5 right-1.5 rounded-none bg-[rgba(20,22,27,0.7)] px-[7px] py-[2px] text-[0.5625rem] font-medium text-white">
          {t('video')}
        </span>
      )}

      {/* Cover badge / make-cover star */}
      {tile.isCover ? (
        <span className="absolute left-1.5 top-1.5 rounded-none bg-accent px-[7px] py-[2px] text-[0.59375rem] font-medium text-on-accent">
          ★ {t('cover')}
        </span>
      ) : (
        interactive && (
          <button
            type="button"
            aria-label={t('makeCover')}
            title={t('makeCover')}
            onClick={onMakeCover}
            className="focus-ring absolute left-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-none bg-surface/95 text-[0.75rem] text-ink-2 hover:text-accent"
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
          onPointerDown={(event) => {
            if (event.button !== 0 || !event.isPrimary) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            dragControls.start(event);
          }}
          onKeyDown={onHandleKeyDown}
          className="focus-ring absolute right-1.5 top-1.5 flex h-9 w-9 touch-none items-center justify-center rounded-none bg-surface/95 text-[0.6875rem] text-ink-2"
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
            'focus-ring absolute flex h-9 w-9 items-center justify-center rounded-none bg-surface/95 text-danger',
            interactive ? 'bottom-1.5 left-1.5' : 'right-1.5 top-1.5',
          )}
        >
          <svg
            viewBox="0 0 12 13"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          >
            <path d="M1 3h10M4.5 3V1.5h3V3M2.5 3l.6 8h5.8l.6-8M4.8 5.5v3.5M7.2 5.5v3.5" />
          </svg>
        </button>
      )}

      {interactive && tile.type === 'image' && tile.mediaId && onPhotoAi && <button type="button" onClick={onPhotoAi} className="focus-ring absolute bottom-1.5 right-1.5 min-h-11 bg-surface/95 px-2 text-xs font-medium text-ink">{t('photoAi')}</button>}

      {/* Status overlays */}
      {tile.phase === 'ready' && !tile.isCover && tile.type !== 'image' && (
        <span className="absolute bottom-1.5 right-1.5 pointer-events-none rounded-none bg-[rgba(31,157,87,0.92)] px-[7px] py-[2px] text-[0.5625rem] font-medium text-white group-hover:opacity-0">
          ✓ {t('statusReady')}
        </span>
      )}

      {tile.phase === 'uploading' && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-2/95 px-3"
          aria-live="polite"
        >
          <span className="font-heading text-[0.8125rem] font-medium text-accent tabular">
            {Math.round(tile.progress)}%
          </span>
          <div
            role="progressbar"
            aria-valuenow={Math.round(tile.progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('statusUploading', { percent: Math.round(tile.progress) })}
            className="h-[5px] w-full overflow-hidden rounded-none bg-line-input"
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
          <span className="text-[0.625rem] font-medium text-ink-3">{t('statusProcessing')}</span>
        </div>
      )}

      {tile.phase === 'failed' && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 border border-danger-line bg-danger-bg px-2 text-center"
          title={tile.failureReason ?? undefined}
        >
          <span aria-hidden className="text-[0.9375rem] leading-none text-danger">
            ✕
          </span>
          <span className="text-[0.625rem] font-medium text-danger">{t('statusFailed')}</span>
          {tile.failureReason && (
            <span className="line-clamp-2 text-[0.5625rem] font-medium leading-tight text-danger/80">
              {tile.failureReason}
            </span>
          )}
          {tile.canRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="focus-ring rounded-none text-[0.59375rem] font-medium text-accent hover:text-accent-hover"
            >
              {t('retry')}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
