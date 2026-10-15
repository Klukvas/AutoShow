import { cn } from '@/lib/cn';

/** White grouped card with the 13/700 uppercase group heading (handoff 1d). */
export function SectionCard({
  title,
  children,
  className,
  contentClassName,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn('min-w-0 rounded-none border border-line bg-surface p-5', className)}>
      {title && (
        <h2 className="mb-4 text-[0.8125rem] font-medium uppercase tracking-[0.05em] text-ink-2">
          {title}
        </h2>
      )}
      <div className={contentClassName}>{children}</div>
    </section>
  );
}
