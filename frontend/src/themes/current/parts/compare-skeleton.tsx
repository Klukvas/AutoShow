// The most cars a comparison holds.
const PLACEHOLDER_COLUMNS = [0, 1, 2];

/** The compare table while its cars load: a header of car placeholders, one row per spec. */
export function CompareSkeleton({ rowCount }: { rowCount: number }) {
  return (
    <div className="overflow-x-auto" aria-hidden>
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr>
            <th className="w-[120px] p-2" />
            {PLACEHOLDER_COLUMNS.map((column) => (
              <th key={column} className="p-2 align-top">
                <div className="flex flex-col gap-2">
                  <div className="aspect-[4/3] animate-pulse rounded-none border border-line bg-surface-2" />
                  <div className="h-[18px] w-3/4 animate-pulse rounded-chip bg-surface-2" />
                  <div className="h-9 w-16 animate-pulse rounded-chip bg-surface-2" />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }, (_, row) => (
            <tr key={row} className="border-t border-line/70">
              <th className="p-2 text-left">
                <div className="h-3.5 w-16 animate-pulse rounded-chip bg-surface-2" />
              </th>
              {PLACEHOLDER_COLUMNS.map((column) => (
                <td key={column} className="p-2">
                  <div className="h-4 w-24 animate-pulse rounded-chip bg-surface-2" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
