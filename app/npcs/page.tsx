'use client';

import { PaginatedTable } from '@/components/ui/paginated-table';
import {
  createIdColumn,
  createGameValColumn,
  createNameColumn,
  createNpcImageColumn,
} from '@/components/ui/table-columns/common-columns';
import { useInfoContent } from '@/hooks/useInfoContent';

export default function NpcsPage() {
  const { info, infoContent } = useInfoContent({
    endpoint: 'npcs',
    title: 'NPCs Information',
    description: 'Use the search modes to find NPCs by ID, name, or gameval.',
  });

  const columns = [
    createNpcImageColumn(),
    createIdColumn(),
    createNameColumn(),
    createGameValColumn(),
  ];

  return (
    <PaginatedTable
      endpoint="npcs"
      columns={columns}
      title="NPCs"
      itemsPerPage={50}
      disabledModes={[]}
      defaultSearchMode="gameval"
      infoContent={infoContent}
      externalInfo={info}
    />
  );
}

