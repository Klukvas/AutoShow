'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { MAX_COMPARE, useCompare } from '@/lib/compare';

/**
 * Global sticky tray showing how many cars are queued for comparison, with a
 * link to /compare and a clear button. Hidden when empty or already on the
 * /compare page (which has its own controls).
 *
 * Apple-fluid: it springs up from below — a little bounce (damping ~0.8) is
 * right here because the tray "arrives" like a thrown object (§4/§6/§8). Exit
 * mirrors the entrance (§7). Reduced-motion collapses it to a fade (§14).
 */
export function CompareBar() {
  const t = useTranslations('compare');
  const pathname = usePathname();
  const { slugs, ready, clear } = useCompare();
  const reduce = useReducedMotion();

  const visible = ready && slugs.length > 0 && pathname !== '/compare';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
          transition={
            reduce
              ? { duration: 0.15 }
              : {
                  y: { type: 'spring', bounce: 0.28, duration: 0.4 },
                  scale: { type: 'spring', bounce: 0.28, duration: 0.4 },
                  opacity: { duration: 0.18, ease: 'easeOut' },
                }
          }
          style={{ willChange: 'transform, opacity' }}
        >
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-line bg-surface/95 px-4 py-2.5 shadow-panel backdrop-blur-sm">
            <span className="text-sub font-semibold text-ink">
              {t('trayCount', { count: slugs.length, max: MAX_COMPARE })}
            </span>
            <Link
              href="/compare"
              className="focus-ring inline-flex h-9 items-center rounded-full bg-accent px-4 text-sub font-bold text-on-accent transition-[background-color,transform] duration-100 hover:bg-accent-hover active:scale-[0.97]"
            >
              {t('open')}
            </Link>
            <button
              type="button"
              onClick={clear}
              className="focus-ring inline-flex h-9 items-center rounded-full px-2 text-sub font-semibold text-ink-3 transition-colors hover:text-ink-2"
            >
              {t('clear')}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
