'use client';

import { useState, lazy, Suspense } from 'react';
import { PaginatedTable } from '@/components/ui/paginated-table';
import RSColorBox from '@/components/ui/RSColorBox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createIdColumn } from '@/components/ui/table-columns/common-columns';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load heavy components
const RSTexture = lazy(() => import('@/components/ui/RSTexture').then(m => ({ default: m.default })));

export default function UnderlaysOverlaysPage() {
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const overlayColumns = [
    createIdColumn(),
    {
      key: 'primaryRgb',
      label: 'Primary RGB',
      render: ({ data }: { id: string; data: any }) => (
        <RSColorBox
          width={32}
          height={32}
          packedHsl={data?.primaryRgb}
          showHex={false}
          tooltip={true}
        />
      ),
    },
    {
      key: 'secondaryRgb',
      label: 'Secondary RGB',
      render: ({ data }: { id: string; data: any }) => {
        const secondaryRgb = data?.secondaryRgb;
        if (secondaryRgb === -1 || secondaryRgb === undefined) {
          return <span className="text-muted-foreground">-</span>;
        }
        return (
          <RSColorBox
            width={32}
            height={32}
            packedHsl={secondaryRgb}
            showHex={false}
            tooltip={true}
          />
        );
      },
    },
    {
      key: 'texture',
      label: 'Texture',
      render: ({ data, id }: { id: string; data: any }) => {
        const texture = data?.texture;
        if (texture === -1 || texture === undefined) {
          return <span className="text-muted-foreground">-</span>;
        }
        return (
          <Suspense fallback={<Skeleton className="w-8 h-8" />}>
            <RSTexture
              id={texture}
              width={32}
              height={32}
              rounded
              thumbnail
              saveSprite={true}
              enableClickModel={true}
              modalOpen={selectedRow?.id === id ? modalOpen : false}
              onModalOpenChange={(open) => {
                if (open) {
                  setSelectedRow({ id, data });
                  setModalOpen(true);
                } else {
                  setModalOpen(false);
                  setSelectedRow(null);
                }
              }}
            />
          </Suspense>
        );
      },
    },
    {
      key: 'water',
      label: 'Water',
      render: ({ data }: { id: string; data: any }) => {
        const water = data?.water;
        if (water === -1 || water === undefined) {
          return <span className="text-muted-foreground">-</span>;
        }
        return <span>{water}</span>;
      },
    },
    {
      key: 'hideUnderlay',
      label: 'Hide Underlay',
      render: ({ data }: { id: string; data: any }) => {
        const hideUnderlay = data?.hideUnderlay;
        return <span>{hideUnderlay ? 'Yes' : 'No'}</span>;
      },
    },
  ];

  const underlayColumns = [
    createIdColumn(),
    {
      key: 'rgb',
      label: 'RGB',
      render: ({ data }: { id: string; data: any }) => (
        <RSColorBox
          width={32}
          height={32}
          packedHsl={data?.rgb}
          showHex={false}
          tooltip={true}
        />
      ),
    },
  ];

  return (
    <div className="w-full h-full flex flex-col">
      <Tabs defaultValue="overlays" className="w-full flex flex-col flex-1 min-h-0">
        <div className="w-full mb-4 flex-shrink-0">
          <div className="w-full max-w-7xl mx-auto px-4">
            <TabsList className="w-full">
              <TabsTrigger value="overlays" className="flex-1">
                Overlays
              </TabsTrigger>
              <TabsTrigger value="underlays" className="flex-1">
                Underlays
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="overlays" className="!mt-0">
          <div className="h-[calc(100vh-75px)] [&>div]:!h-full">
            <PaginatedTable
              endpoint="overlays"
              columns={overlayColumns}
              title="Overlays"
              itemsPerPage={50}
              disabledModes={['name', 'gameval']}
              defaultSearchMode="id"
            />
          </div>
        </TabsContent>

        <TabsContent value="underlays" className="!mt-0">
          <div className="h-[calc(100vh-75px)] [&>div]:!h-full">
            <PaginatedTable
              endpoint="underlays"
              columns={underlayColumns}
              title="Underlays"
              itemsPerPage={50}
              disabledModes={['name', 'gameval']}
              defaultSearchMode="id"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

