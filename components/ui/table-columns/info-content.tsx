'use client';

interface InfoStats {
  totalEntries?: number;
  uniqueNames?: number;
  entriesWithGameVal?: number;
  uniqueGameVals?: number;
  [key: string]: number | undefined;
}

interface InfoContentProps {
  title: string;
  stats: InfoStats;
  description?: string;
  extraStats?: Array<{ label: string; value: number | undefined }>;
}

export function TableInfoContent({ title, stats, description, extraStats }: InfoContentProps) {
  return (
    <>
      <p className="font-semibold mb-2">{title}</p>
      <div className="space-y-1">
        {stats.totalEntries !== undefined && (
          <p>Total Entries: {stats.totalEntries.toLocaleString()}</p>
        )}
        {stats.uniqueNames !== undefined && (
          <p>Unique Names: {stats.uniqueNames.toLocaleString()}</p>
        )}
        {stats.entriesWithGameVal !== undefined && (
          <p>Entries with GameVal: {stats.entriesWithGameVal.toLocaleString()}</p>
        )}
        {stats.uniqueGameVals !== undefined && (
          <p>Unique GameVals: {stats.uniqueGameVals.toLocaleString()}</p>
        )}
        {extraStats?.map((stat, idx) => (
          <p key={idx}>
            {stat.label}: {stat.value !== undefined ? stat.value.toLocaleString() : '-'}
          </p>
        ))}
      </div>
      {description && (
        <>
          <p className="mt-3 pt-3 border-t text-sm">{description}</p>
          <p className="mt-2 text-sm">Hover over the info icon to see help for the current search mode.</p>
        </>
      )}
    </>
  );
}

