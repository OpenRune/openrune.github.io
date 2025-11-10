'use client';

import { useState, useEffect } from 'react';
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
import OSRSMap from '@/components/map/OSRSMap';
import { IMAGE_URLS } from '@/lib/constants/imageUrls';

interface ObjectData {
  id: string;
  name?: string;
  gameVal?: string;
}

export default function ObjectsPage() {
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null);
  const [objectData, setObjectData] = useState<ObjectData | null>(null);
  const [objectDataLoading, setObjectDataLoading] = useState(false);

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

  // Fetch object data when objectId is selected
  useEffect(() => {
    if (selectedObjectId) {
      setObjectDataLoading(true);
      const fetchObjectData = async () => {
        try {
          const params = new URLSearchParams({
            mode: 'id',
            q: selectedObjectId.toString(),
            amt: '1',
            offset: '0',
          });
          const response = await fetch(`/api/objects?${params.toString()}`);
          if (response.ok) {
            const data = await response.json();
            if (data.results && data.results.length > 0) {
              setObjectData(data.results[0]);
            } else {
              // If not found, set minimal data
              setObjectData({ id: selectedObjectId.toString() });
            }
          } else {
            setObjectData({ id: selectedObjectId.toString() });
          }
        } catch (error) {
          console.error('Error fetching object data:', error);
          setObjectData({ id: selectedObjectId.toString() });
        } finally {
          setObjectDataLoading(false);
        }
      };
      fetchObjectData();
    } else {
      setObjectData(null);
      setObjectDataLoading(false);
    }
  }, [selectedObjectId]);

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
      <Dialog open={mapModalOpen} onOpenChange={(open) => {
        setMapModalOpen(open);
        if (!open) {
          // Reset selected object when dialog closes
          setSelectedObjectId(null);
        }
      }}>
        <DialogContent className="!max-w-[50vw] !w-[50vw] !max-h-[80vh] !h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-3">
              {objectDataLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span>Loading...</span>
                </div>
              ) : objectData && selectedObjectId ? (
                <>
                  <img
                    src={IMAGE_URLS.object(selectedObjectId)}
                    alt={objectData.name || `Object ${selectedObjectId}`}
                    className="w-12 h-12 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = IMAGE_URLS.fallback;
                    }}
                  />
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {objectData.name || `Object ${selectedObjectId}`}
                      </span>
                      {objectData.gameVal && (
                        <span className="text-sm text-muted-foreground">
                          ({objectData.gameVal})
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      ID: {selectedObjectId}
                    </span>
                  </div>
                </>
              ) : (
                <span>Map - Object ID: {selectedObjectId}</span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full h-full min-h-0 relative">
            {selectedObjectId && (
              <OSRSMap initialObjectId={selectedObjectId} compact={true} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

