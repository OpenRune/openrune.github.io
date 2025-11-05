'use client';

import { PaginatedTable } from '@/components/ui/paginated-table';
import {
  createIdColumn,
  createGameValColumn,
  createNameColumn,
  createBooleanColumn,
  createItemImageColumn,
} from '@/components/ui/table-columns/common-columns';
import { useInfoContent } from '@/hooks/useInfoContent';
import { calculateFilteredCount } from '@/lib/utils/filterCounts';

export default function ItemsPage() {
  const { info, infoContent } = useInfoContent({
    endpoint: 'items',
    title: 'Items Information',
    description: 'Use the search modes to find items by ID, name, or gameval.',
    extraStats: (info) => [
      { label: 'Noted Entries', value: info?.notedEntries },
      { label: 'Entries with Null Names', value: info?.entriesWithNullNames },
      { label: 'Entries with Non-Null Names', value: info?.entriesWithNoneNullNames },
    ],
  });

  const columns = [
    createItemImageColumn(),
    createIdColumn(),
    createNameColumn(),
    createGameValColumn(),
    createBooleanColumn('noted', 'Noted'),
  ];

  const getTotalCount = (info: any, filterState: Record<string, boolean>) =>
    calculateFilteredCount(info, filterState, {
      filterKey: 'notedOnly',
      countField: 'notedEntries',
      requireNameField: 'entriesWithNoneNullNames',
    });

  return (
    <PaginatedTable
      endpoint="items"
      columns={columns}
      title="Items"
      itemsPerPage={50}
      disabledModes={[]}
      defaultSearchMode="gameval"
      infoContent={infoContent}
      getTotalCount={getTotalCount}
      externalInfo={info}
      filters={[
        { key: 'notedOnly', label: 'Noted Only' },
        { key: 'requireName', label: 'Require Name' },
      ]}
    />
  );
}

