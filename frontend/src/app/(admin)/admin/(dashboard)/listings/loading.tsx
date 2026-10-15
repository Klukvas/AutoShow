import { TableSkeleton } from '@/components/admin/ui/skeletons';

export default function ListingsLoading() {
  return (
    <div>
      <div className="mb-5">
        <div className="skeleton h-7 w-40 rounded-none" />
        <div className="skeleton mt-2 h-3.5 w-56 rounded-none" />
      </div>
      <div className="mb-4 flex gap-[9px]">
        <div className="skeleton h-10 w-full max-w-[320px] rounded-none" />
        <div className="skeleton hidden h-10 w-32 rounded-none md:block" />
      </div>
      <TableSkeleton />
    </div>
  );
}
