'use client';

import { PaginatedTable } from '@/components/ui/paginated-table';
import {
  createIdColumn,
  createGameValColumn,
  createTickDurationColumn,
} from '@/components/ui/table-columns/common-columns';
import { useInfoContent } from '@/hooks/useInfoContent';

export default function SequencesPage() {
  const { info, infoContent } = useInfoContent({
    endpoint: 'sequences',
    title: 'Sequences Information',
    description: 'Use the search modes to find sequences by ID or gameval.',
  });

  const columns = [
    createIdColumn(),
    createGameValColumn(),
    createTickDurationColumn(),
  ];

  return (
    <PaginatedTable
      endpoint="sequences"
      columns={columns}
      title="Sequences"
      itemsPerPage={50}
      disabledModes={['name']}
      defaultSearchMode="gameval"
      infoContent={infoContent}
      externalInfo={info}
    />
  );
}

