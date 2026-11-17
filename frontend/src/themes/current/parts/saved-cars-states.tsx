import Link from 'next/link';

/**
 * Notice of the favorites and compare pages when some saved cars did not load. The
 * slugs are kept, so the retry can still bring them; it is disabled while one runs.
 * `className` is the page's own spacing around the notice.
 */
export function SavedCarsLoadError({
  message,
  retryLabel,
  isRetrying,
  onRetry,
  className,
}: {
  message: string;
  retryLabel: string;
  isRetrying: boolean;
  onRetry: () => void;
  className: string;
}) {
  return (
    <div
      className={`${className} flex flex-col items-start gap-4 rounded-card border border-danger-line bg-danger-bg p-4`}
    >
      <p role="alert" className="text-sub font-medium text-danger">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        className="focus-ring inline-flex h-11 items-center rounded-btn bg-accent px-5 text-sub font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {retryLabel}
      </button>
    </div>
  );
}

/** Nothing saved on the favorites or compare page: a hint and the way to the catalogue. */
export function SavedCarsEmpty({
  message,
  catalogLabel,
  className,
}: {
  message: string;
  catalogLabel: string;
  className: string;
}) {
  return (
    <div className={`${className} flex flex-col items-start gap-4`}>
      <p className="text-body-md text-ink-2">{message}</p>
      <Link
        href="/cars"
        className="focus-ring inline-flex h-11 items-center rounded-btn bg-accent px-5 text-sub font-medium text-on-accent transition-colors hover:bg-accent-hover"
      >
        {catalogLabel}
      </Link>
    </div>
  );
}
