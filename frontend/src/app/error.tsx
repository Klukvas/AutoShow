'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

/**
 * Application-level error boundary — the first owner of the segment tree that
 * sits *above* the root layout's `{children}` slot.
 *
 * A failure inside a layout cannot be caught by that same segment's
 * `error.tsx`: the boundary is rendered by the layout that already threw, so
 * the error propagates one level up. The concrete case is the fail-closed
 * `getInstallation()` in `(public)/layout.tsx` — with the API unreachable
 * every public route (`/`, `/cars`, `/favorites`, `/compare`) used to fall
 * through to the framework's bare "Application error: a server-side exception
 * has occurred" page. This boundary keeps the operator fail-closed contract
 * intact and only replaces the *presentation* of the failure.
 *
 * `error` and `reset` are accepted because Next's boundary contract requires
 * them, but neither is read. `message`/`digest` are deliberately not rendered:
 * production redacts server-side messages, so the only thing a user could see
 * is an opaque digest.
 *
 * The retry button performs a full document reload instead of calling
 * `reset()`. In Next 15 `reset()` re-renders the failed segment without
 * issuing a new RSC request, so a server-side throw in `(public)/layout.tsx`
 * would replay the same failure even after the API has recovered. Only a
 * fresh document — and with it a new RSC render on the server — can succeed.
 */
export default function AppError({
  // Intentionally unused props, kept for the Next error-boundary contract.
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-5 text-ink">
      <div
        role="alert"
        className="mx-auto flex max-w-lg flex-col items-center py-16 text-center"
      >
        <span
          aria-hidden
          className="flex h-14 w-14 items-center justify-center rounded-input bg-danger-bg text-xl font-medium text-danger"
        >
          !
        </span>
        <h1 className="mt-5 font-heading text-section font-medium text-ink">{t('title')}</h1>
        <p className="mt-1.5 text-body-md text-ink-2">{t('body')}</p>
        <Button variant="solid" className="mt-6" onClick={() => window.location.reload()}>
          {t('retry')}
        </Button>
        <Link
          href="/"
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-input px-2 text-body-md font-medium text-ink-2 underline decoration-line-input underline-offset-4 transition-colors hover:text-ink focus-ring"
        >
          {t('backHome')}
        </Link>
      </div>
    </main>
  );
}
