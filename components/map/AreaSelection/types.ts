import { Position } from '@/lib/map/model/Position';
import { CollectionControl } from '@/lib/map/controls/CollectionControl';

export type ToolType = 'area' | 'poly' | 'path' | null;

export interface Area {
    id: string;
    type: 'area';
    bounds: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    };
    name?: string; // Optional session-only name
}

export interface Poly {
    id: string;
    type: 'poly';
    points: Array<{ x: number; y: number }>;
    name?: string; // Optional session-only name
}

export interface Path {
    id: string;
    type: 'path';
    points: Array<{ x: number; y: number; z?: number }>;
    name?: string; // Optional session-only name
}

export type SelectionItem = Area | Poly | Path;

export interface AreaSelectionProps {
    onItemClick?: (item: SelectionItem) => void;
    onJumpToPosition?: (position: Position) => void;
    onItemSelected?: (item: SelectionItem | null) => void;
    collectionControl?: CollectionControl | null;
    importMode?: boolean;
    importFormat?: 'normal' | '117hd';
    onImportModeChange?: (isImportMode: boolean) => void;
}

export type ExportFormat = 'json' | 'java' | 'array' | 'raw';
export type ImportFormat = 'normal' | '117hd';
export type ImportType = 'area' | 'poly' | 'auto';

