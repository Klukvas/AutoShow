'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

type ToastTone = 'success' | 'error';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastValue {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

const AUTO_DISMISS_MS = 4_000;
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
    (message: string, tone: ToastTone = 'success') => {
      const id = nextId.current++;
      setItems((prev) => [...prev.slice(-(MAX_STACK - 1)), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {mounted &&
        createPortal(
          <div
            aria-live="polite"
            className="pointer-events-none fixed bottom-5 right-5 z-[120] flex w-[min(360px,calc(100vw-40px))] flex-col gap-2"
          >
            {items.map((item) => (
              <div
                key={item.id}
                role="status"
                className={cn(
                  'pointer-events-auto flex items-start gap-2.5 rounded-[11px] border px-3.5 py-2.5 shadow-panel',
                  item.tone === 'success'
                    ? 'border-line bg-surface text-ink'
                    : 'border-danger/40 bg-danger-bg text-ink',
                )}
              >
                <span aria-hidden className="mt-px text-[14px]">
                  {item.tone === 'success' ? '✅' : '⚠️'}
                </span>
                <span className="flex-1 text-[13px] font-semibold leading-snug">
                  {item.message}
                </span>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => dismiss(item.id)}
                  className="focus-ring -mr-1 -mt-0.5 rounded-[6px] px-1.5 text-[15px] leading-none text-ink-3 hover:text-ink"
                >
                  ×
                </button>
              </div>
            ))}
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
