import type { TableColumn } from '../paginated-table';
import { IMAGE_URLS } from '@/lib/constants/imageUrls';

// Common column renderers
export const renderIdColumn = ({ id }: { id: string }) => (
  <span className="font-mono text-sm">{id}</span>
);

export const renderGameValColumn = ({ data }: { data: any }) => (
  <span>{data?.gameVal || '-'}</span>
);

export const renderNameColumn = ({ data }: { data: any }) => (
  <span>{data?.name || '-'}</span>
);

export const renderBooleanColumn = ({ data, field }: { data: any; field: string }) => (
  <span>{data?.[field] ? 'Yes' : 'No'}</span>
);

export const renderTickDurationColumn = ({ data }: { data: any }) => {
  const tickDuration = data?.tickDuration;
  if (tickDuration === undefined || tickDuration === null) {
    return <span>-</span>;
  }
  const seconds = (tickDuration * 0.6).toFixed(1);
  return (
    <span>
      {tickDuration} ticks ({seconds}s)
    </span>
  );
};

export const renderImageColumn = ({
  id,
  data,
  imageUrl,
  altText,
  className = 'object-contain',
  width,
  height,
}: {
  id: string | number;
  data: any;
  imageUrl: string;
  altText?: string;
  className?: string;
  width?: number;
  height?: number;
}) => (
  <img
    src={imageUrl}
    onError={(e) => {
      e.currentTarget.src = IMAGE_URLS.fallback;
    }}
    className={className}
    alt={altText || data?.name || `Item ${id}`}
    style={width && height ? { width: `${width}px`, height: `${height}px`, maxWidth: `${width}px`, maxHeight: `${height}px` } : undefined}
    loading="lazy"
    decoding="async"
  />
);

// Common column definitions
export const createIdColumn = (): TableColumn => ({
  key: 'id',
  label: 'ID',
  render: renderIdColumn,
});

export const createGameValColumn = (): TableColumn => ({
  key: 'gameVal',
  label: 'Gameval',
  render: renderGameValColumn,
});

export const createNameColumn = (): TableColumn => ({
  key: 'name',
  label: 'Name',
  render: renderNameColumn,
});

export const createBooleanColumn = (key: string, label: string): TableColumn => ({
  key,
  label,
  render: ({ data }: { id: string; data: any }) => renderBooleanColumn({ data, field: key }),
});

export const createTickDurationColumn = (): TableColumn => ({
  key: 'tickDuration',
  label: 'Tick Duration',
  render: renderTickDurationColumn,
});

export const createObjectImageColumn = (): TableColumn => ({
  key: 'image',
  label: 'Image',
  className: 'w-12', // Add className for skeleton size detection
  render: ({ id, data }: { id: string; data: any }) =>
    renderImageColumn({
      id,
      data,
      imageUrl: IMAGE_URLS.object(id),
      altText: data?.name || `Object ${id}`,
      className: 'w-12 h-12 object-contain',
    }),
});

export const createNpcImageColumn = (): TableColumn => ({
  key: 'image',
  label: 'Image',
  className: 'w-16', // 64px skeleton
  render: ({ id, data }: { id: string; data: any }) =>
    renderImageColumn({
      id,
      data,
      imageUrl: IMAGE_URLS.npc(id),
      altText: data?.name || `NPC ${id}`,
      className: 'object-contain',
      width: 64,
      height: 64,
    }),
});

export const createItemImageColumn = (): TableColumn => ({
  key: 'image',
  label: 'Image',
  className: 'w-8', // 32px skeleton
  render: ({ id, data }: { id: string; data: any }) =>
    renderImageColumn({
      id,
      data,
      imageUrl: IMAGE_URLS.sprite(id),
      altText: data?.name || `Item ${id}`,
      className: 'object-contain',
      width: 32,
      height: 32,
    }),
});

