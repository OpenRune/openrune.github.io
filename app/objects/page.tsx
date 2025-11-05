'use client';

import { useState } from 'react';
import { PaginatedTable } from '@/components/ui/paginated-table';
import {
  createIdColumn,
  createGameValColumn,
  createNameColumn,
  createBooleanColumn,
  createObjectImageColumn,
} from '@/components/ui/table-columns/common-columns';
import { useInfoContent } from '@/hooks/useInfoContent';
import { calculateFilteredCount } from '@/lib/utils/filterCounts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IconMap } from '@tabler/icons-react';
import type { TableColumn } from '@/components/ui/paginated-table';

export default function ObjectsPage() {
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null);

  const { info, infoContent } = useInfoContent({
    endpoint: 'objects',
    title: 'Objects Information',
    description: 'Use the search modes to find objects by ID, name, or gameval.',
    extraStats: (info) => [
      { label: 'Interactive Entries', value: info?.interactiveEntries },
      { label: 'Entries with Null Names', value: info?.entriesWithNullNames },
      { label: 'Entries with Non-Null Names', value: info?.entriesWithNoneNullNames },
    ],
  });

  const handleMapClick = (objectId: number) => {
    setSelectedObjectId(objectId);
    setMapModalOpen(true);
  };

  const locateColumn: TableColumn = {
    key: 'locate',
    label: 'Locate Object',
    render: ({ id }) => (
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleMapClick(Number(id))}
      >
        <IconMap size={16} className="mr-2" />
        Locate
      </Button>
    ),
  };

  const columns = [
    createObjectImageColumn(),
    createIdColumn(),
    createNameColumn(),
    createGameValColumn(),
    createBooleanColumn('interactive', 'Interactive'),
    locateColumn,
  ];

  const getTotalCount = (info: any, filterState: Record<string, boolean>) =>
    calculateFilteredCount(info, filterState, {
      filterKey: 'interactiveOnly',
      countField: 'interactiveEntries',
      requireNameField: 'entriesWithNoneNullNames',
    });

  return (
    <>
      <PaginatedTable
        endpoint="objects"
        columns={columns}
        title="Objects"
        itemsPerPage={50}
        disabledModes={[]}
        defaultSearchMode="gameval"
        infoContent={infoContent}
        getTotalCount={getTotalCount}
        externalInfo={info}
        filters={[
          { key: 'interactiveOnly', label: 'Interactive Only' },
          { key: 'requireName', label: 'Require Name' },
        ]}
      />
      <Dialog open={mapModalOpen} onOpenChange={setMapModalOpen}>
        <DialogContent className="!max-w-[50vw] !w-[50vw] !max-h-[95vh] !h-[95vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>
              Map - Object ID: {selectedObjectId}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full h-full min-h-0 pb-6 px-6">
            <iframe
              src={selectedObjectId ? `https://mejrs.github.io/osrs?objectid=${selectedObjectId}` : 'https://mejrs.github.io/osrs'}
              className="w-full h-full border-0 rounded"
              title="OSRS Map"
              allowFullScreen
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

