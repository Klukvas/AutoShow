import { cn } from '@/lib/cn';

/** Centered empty state: glyph + title + body + optional action (handoff 1b). */
export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-16 text-center', className)}>
      <div aria-hidden className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-ink/[0.05] text-ink-3">
        {icon ?? <CarOutline className="h-6 w-9" />}
      </div>
      <h2 className="font-heading text-[17px] font-bold tracking-tight text-ink">{title}</h2>
      {body && <p className="mt-1.5 max-w-[360px] text-[13px] font-medium text-ink-3">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function CarOutline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 44" fill="currentColor" aria-hidden className={className}>
      <path d="M14 30c2-8 10-14 22-15l8-6c3-2 7-3 11-3h14c5 0 9 2 12 5l6 6 16 3c6 1 10 5 10 10v2c0 1-1 2-2 2h-8a9 9 0 0 0-18 0H44a9 9 0 0 0-18 0h-9c-2 0-3-1-3-3v-1z" />
      <circle cx="35" cy="34" r="6" />
      <circle cx="93" cy="34" r="6" />
    </svg>
  );
}
