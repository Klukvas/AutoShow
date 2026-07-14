import { cn } from '@/lib/cn';

/** Shimmering line — honours prefers-reduced-motion via the global rule. */
export function SkeletonLine({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton h-3 rounded-[6px]', className)} />;
}

/** Table-shaped loading state for admin lists (handoff 1b skeleton block). */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="overflow-hidden rounded-[12px] border border-line bg-surface"
    >
      <div className="h-10 border-b border-line bg-thead" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line/60 px-4 py-3 md:px-[18px]">
          <div className="skeleton h-[38px] w-[50px] flex-none rounded-[7px]" />
          <SkeletonLine className="w-[30%]" />
          <SkeletonLine className="hidden w-[12%] md:block" />
          <SkeletonLine className="hidden w-[10%] md:block" />
          <SkeletonLine className="ml-auto w-[8%]" />
        </div>
      ))}
    </div>
  );
}
