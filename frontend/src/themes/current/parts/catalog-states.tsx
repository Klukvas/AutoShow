import Link from 'next/link';
import { Button } from '@/components/ui/button';

/** Handoff 1c "empty by filter": soft-square icon, title, hint, reset CTA. */
export function CatalogEmptyState({
  title,
  body,
  resetLabel,
}: {
  title: string;
  body: string;
  resetLabel: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-card border border-line bg-surface px-6 py-16 text-center">
      <span
        aria-hidden
        className="flex h-14 w-14 items-center justify-center rounded-input bg-bg text-xl text-ink-3"
      >
        ⌕
      </span>
      <h2 className="mt-5 font-heading text-section font-medium text-ink">{title}</h2>
      <p className="mt-1.5 max-w-sm text-body-md text-ink-2">{body}</p>
      <Link
        href="/cars"
        className="focus-ring mt-6 inline-flex h-11 items-center rounded-input bg-accent px-5 text-sub font-medium text-on-accent transition-colors hover:bg-accent-hover"
      >
        {resetLabel}
      </Link>
    </div>
  );
}

/**
 * API failure state — same visual language as cars/error.tsx (danger square,
 * errorTitle/errorBody/errorRetry), but rendered inside the catalogue shell so
 * the user keeps their filters and can retry without losing context. A plain
 * anchor is intentional: it forces a fresh document/RSC request, bypassing
 * both the client router cache and a cached failure render.
 */
export function CatalogErrorState({
  title,
  body,
  retryLabel,
  retryHref,
}: {
  title: string;
  body: string;
  retryLabel: string;
  retryHref: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-card border border-line bg-surface px-6 py-16 text-center">
      <span
        aria-hidden
        className="flex h-14 w-14 items-center justify-center rounded-input bg-danger-bg text-xl font-medium text-danger"
      >
        !
      </span>
      <h2 className="mt-5 font-heading text-section font-medium text-ink">{title}</h2>
      <p className="mt-1.5 max-w-sm text-body-md text-ink-2">{body}</p>
      <Button as="a" variant="solid" className="mt-6" href={retryHref}>
        {retryLabel}
      </Button>
    </div>
  );
}
