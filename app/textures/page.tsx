'use client';

import { PaginatedTable } from '@/components/ui/paginated-table';
import RSTexture from '@/components/ui/RSTexture';
import { Badge } from '@/components/ui/badge';
import RSColorBox from '@/components/ui/RSColorBox';
import { useInfoContent } from '@/hooks/useInfoContent';
import { useCacheType } from '@/components/layout/cache-type-provider';
import { useDownloadManager } from '@/components/download-manager';

export default function TexturesPage() {
  const { selectedCacheType } = useCacheType();
  const { startDownload } = useDownloadManager();
  
  const getBackendUrl = () => {
    if (selectedCacheType) {
      return `https://${selectedCacheType.ip}:${selectedCacheType.port}`;
    }
    return 'https://localhost:8090';
  };

  const handleDownload = () => {
    startDownload('TEXTURES', getBackendUrl());
  };

  const { info, infoContent } = useInfoContent({
    endpoint: 'textures',
    title: 'Textures Information',
    description: 'Click on a texture to view it in full size and see additional details.',
  });

  const columns = [
    {
      key: 'image',
      label: 'Image',
      className: 'w-16', // 64px skeleton
      render: ({ id, data }: { id: string; data: any }) => (
        <RSTexture
          id={Number(id)}
          width={64}
          height={64}
          rounded
          thumbnail
          enableClickModel={true}
          textureData={data}
          extraData={data}
        />
      ),
    },
    {
      key: 'gameval',
      label: 'Gameval',
      render: ({ data }: { id: string; data: any }) => <span>{data.name || '-'}</span>,
    },
    {
      key: 'rgb',
      label: 'RGB',
      render: ({ data }: { id: string; data: any }) => (
        <RSColorBox
          width={64}
          height={64}
          packedHsl={data.averageRgb ?? 0}
          showHex={true}
          tooltip={true}
        />
      ),
    },
    {
      key: 'transparency',
      label: 'Transparency',
      render: ({ data }: { id: string; data: any }) => (
        <Badge variant={data.isTransparent ? 'default' : 'secondary'}>
          {data.isTransparent ? 'Yes' : 'No'}
        </Badge>
      ),
    },
    {
      key: 'speed',
      label: 'Speed',
      render: ({ data }: { id: string; data: any }) => (
        <span className="text-sm">{data.animationSpeed ?? '-'}</span>
      ),
    },
    {
      key: 'attachmentCount',
      label: 'Attachment Count',
      render: ({ data }: { id: string; data: any }) => (
        <span className="text-sm">{data.attachments?.total ?? 0}</span>
      ),
    },
  ];

  return (
    <PaginatedTable
      endpoint="textures"
      columns={columns}
      title="Textures"
      itemsPerPage={20}
      totalCountField="totalArchives"
      infoContent={infoContent}
      externalInfo={info}
      downloadButton={{
        type: 'TEXTURES',
        disabled: !selectedCacheType,
        onDownload: handleDownload,
        tooltip: 'Download Texture Images',
        label: 'Download Textures',
      }}
    />
  );
}
