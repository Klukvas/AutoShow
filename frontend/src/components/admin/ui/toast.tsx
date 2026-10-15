'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';

type ToastTone = 'success' | 'error';

/** Optional "take me there" link — e.g. a new lead pointing at the inbox. */
export interface ToastAction {
  label: string;
  href: string;
}

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
}

interface ToastValue {
  toast: (message: string, tone?: ToastTone, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

const AUTO_DISMISS_MS = 4_000;
/** Actionable toasts stay up long enough to actually be clicked. */
const ACTION_DISMISS_MS = 10_000;
const MAX_STACK = 4;

/**
 * Fire-and-forget notifications for SUCCESS feedback (saved, published,
 * queued…) — actions whose banner at the top of a long form nobody sees.
 * Errors that need reading/acting stay as inline banners.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const nextId = useRef(1);

  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = 'success', action?: ToastAction) => {
      const id = nextId.current++;
      setItems((prev) => [...prev.slice(-(MAX_STACK - 1)), { id, message, tone, action }]);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed bottom-5 right-5 z-[120] flex w-[min(360px,calc(100vw-40px))] flex-col gap-2">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <ToastCard key={item.id} item={item} dismiss={dismiss} />
              ))}
            </AnimatePresence>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

function ToastCard({ item, dismiss }: { item: ToastItem; dismiss: (id: number) => void }) {
  const t = useTranslations('admin.common');
  const reduce = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const remaining = useRef(item.action ? ACTION_DISMISS_MS : AUTO_DISMISS_MS);

  useEffect(() => {
    if (hovered || focused) return;
    const started = Date.now();
    const timer = window.setTimeout(() => dismiss(item.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - started));
    };
  }, [hovered, focused, item.id, dismiss]);

  return (
    <motion.div
      role={item.tone === 'error' ? 'alert' : 'status'}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setFocused(false);
      }}
      layout={reduce ? false : 'position'}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
      transition={
        reduce
          ? { duration: 0.14, ease: 'easeOut' }
          : {
              layout: { type: 'spring', bounce: 0, duration: 0.24 },
              y: { type: 'spring', bounce: 0, duration: 0.24 },
              scale: { type: 'spring', bounce: 0, duration: 0.24 },
              opacity: { duration: 0.16, ease: 'easeOut' },
            }
      }
      style={{ willChange: 'transform, opacity' }}
      className={cn(
        'pointer-events-auto flex items-start gap-2.5 rounded-none border px-3.5 py-2.5 shadow-none',
        item.tone === 'success'
          ? 'border-line bg-surface text-ink'
          : 'border-danger/40 bg-danger-bg text-ink',
      )}
    >
      <span aria-hidden className="mt-px text-[0.875rem]">
        {item.tone === 'success' ? '✓' : '⚠'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.8125rem] font-medium leading-snug">{item.message}</span>
        {item.action && (
          <Link
            href={item.action.href}
            onClick={() => dismiss(item.id)}
            className="focus-ring mt-1 inline-block rounded-none text-[0.75rem] font-medium text-accent-hover underline-offset-2 hover:underline"
          >
            {item.action.label}
          </Link>
        )}
      </span>
      <button
        type="button"
        aria-label={t('close')}
        onClick={() => dismiss(item.id)}
        className="focus-ring -mr-1 -mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-none px-1.5 text-[0.9375rem] leading-none text-ink-3 hover:text-ink"
      >
        ×
      </button>
    </motion.div>
  );
}
