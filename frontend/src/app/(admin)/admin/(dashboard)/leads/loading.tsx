export default function LeadsLoading() {
  return (
    <div className="overflow-hidden rounded-none border border-line bg-surface md:flex md:min-h-[520px]">
      <div className="flex-none border-line bg-surface-2 md:w-[400px] md:border-r">
        <div className="px-5 pb-3 pt-[18px]">
          <div className="skeleton h-6 w-28 rounded-none" />
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="border-t border-line/60 px-5 py-[13px]">
            <div className="skeleton h-3.5 w-2/3 rounded-none" />
            <div className="skeleton mt-2 h-3 w-1/2 rounded-none" />
          </div>
        ))}
      </div>
      <div className="hidden flex-1 px-[26px] py-6 md:block">
        <div className="skeleton h-5 w-24 rounded-none" />
        <div className="skeleton mt-3 h-7 w-64 rounded-none" />
        <div className="skeleton mt-6 h-24 w-full rounded-none" />
      </div>
    </div>
  );
}
