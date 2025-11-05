'use client';

import { PaginatedTable } from '@/components/ui/paginated-table';
import { RSSprite } from '@/components/ui/RSSprite';
import { createIdColumn } from '@/components/ui/table-columns/common-columns';
import { useInfoContent } from '@/hooks/useInfoContent';
import { useCacheType } from '@/components/layout/cache-type-provider';
import { useDownloadManager } from '@/components/download-manager';

export default function SpritesPage() {
  const { selectedCacheType } = useCacheType();
  const { startDownload } = useDownloadManager();
  
  const getBackendUrl = () => {
    if (selectedCacheType) {
      return `https://${selectedCacheType.ip}:${selectedCacheType.port}`;
    }
    return 'https://localhost:8090';
  };

  const handleDownload = () => {
    startDownload('SPRITES', getBackendUrl());
  };
  const { info, infoContent } = useInfoContent({
    endpoint: 'sprites',
    title: 'Sprites Information',
    description: 'Click on a sprite to view it in full size and see additional details including subsprites.',
    extraStats: (info) => [
      { label: 'Entries with Names', value: info?.entriesWithNames },
      { label: 'Total Sprites', value: info?.totalSprites },
      { label: 'Entries with Multiple Sprites', value: info?.entriesWithMultipleSprites },
      { label: 'Average Sprites per Entry', value: info?.averageSpritesPerEntry },
    ],
  });

  const columns = [
    {
      key: 'image',
      label: 'Image',
      className: 'w-8', // 32px skeleton
      render: ({ id, data }: { id: string; data: any }) => (
        <RSSprite
          id={id}
          width={32}
          height={32}
          rounded
          thumbnail
          enableClickModel={true}
          showInfoTab={true}
          gameval={data.name}
          keepAspectRatio={true}
          extraData={data}
        />
      ),
    },
    createIdColumn(),
    {
      key: 'gameval',
      label: 'Gameval',
      render: ({ data }: { id: string; data: any }) => <span>{data.name || '-'}</span>,
    },
  ];

  return (
    <PaginatedTable
      endpoint="sprites"
      columns={columns}
      title="Sprites"
      itemsPerPage={50}
      disabledModes={['name']}
      infoContent={infoContent}
      externalInfo={info}
      downloadButton={{
        type: 'SPRITES',
        disabled: !selectedCacheType,
        onDownload: handleDownload,
        tooltip: 'Download Sprite Images',
        label: 'Download Sprites',
      }}
    />
  );
}

