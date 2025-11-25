import { Area as AreaModel } from '@/lib/map/model/Area';
import { Position } from '@/lib/map/model/Position';
import { Area, Poly, Path } from './types';

export function areaModelToSelectionItem(area: AreaModel, index: number): Area & { plane?: number } {
    const minX = Math.min(area.startPosition.x, area.endPosition.x);
    const maxX = Math.max(area.startPosition.x, area.endPosition.x);
    const minY = Math.min(area.startPosition.y, area.endPosition.y);
    const maxY = Math.max(area.startPosition.y, area.endPosition.y);
    return {
        id: `area-${index}`,
        type: 'area',
        bounds: { minX, minY, maxX, maxY },
        plane: area.startPosition.z
    };
}

export function positionsToSelectionItem(positions: Position[], index: number): Poly & { plane?: number } {
    const plane = positions.length > 0 ? positions[0].z : 0;
    return {
        id: `poly-${index}`,
        type: 'poly',
        points: positions.map(pos => ({ x: pos.x, y: pos.y })),
        plane
    };
}

export function positionsToPathItem(positions: Position[], index: number): Path & { plane?: number } {
    const plane = positions.length > 0 ? positions[0].z : 0;
    return {
        id: `path-${index}`,
        type: 'path',
        points: positions.map(pos => ({ x: pos.x, y: pos.y, z: pos.z })),
        plane
    };
}

export function formatArea(area: Area): string {
    return `${area.bounds.minX},${area.bounds.minY},${area.bounds.maxX},${area.bounds.maxY}`;
}

export function formatPoly(poly: Poly): string {
    return `${poly.points.length} points`;
}

export function formatPath(path: Path): string {
    return `${path.points.length} points`;
}

export function detectFormat(text: string): { format: 'json' | 'java' | 'array' | 'raw'; type: 'area' | 'poly' } {
    const trimmed = text.trim();
    
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                if (parsed.length > 0 && typeof parsed[0] === 'object' && ('x' in parsed[0] || Array.isArray(parsed[0]))) {
                    return { format: 'json', type: 'poly' };
                }
                return { format: 'json', type: 'area' };
            }
            if (typeof parsed === 'object') {
                if ('positions' in parsed || 'polygon' in parsed) {
                    return { format: 'json', type: 'poly' };
                }
                if ('areas' in parsed || 'aabbs' in parsed || 'minX' in parsed) {
                    return { format: 'json', type: 'area' };
                }
            }
        } catch (e) {
            // Not valid JSON, continue to other checks
        }
    }
    
    if (trimmed.includes('new AABB') || trimmed.includes('new WorldPoint') || trimmed.includes('WorldArea')) {
        return { format: 'java', type: trimmed.includes('WorldPoint') ? 'poly' : 'area' };
    }
    
    if (trimmed.includes('[') && trimmed.includes(']')) {
        if (trimmed.match(/\[\[\d+/)) {
            return { format: 'array', type: 'poly' };
        }
        return { format: 'array', type: 'area' };
    }
    
    const lines = trimmed.split('\n').filter(line => line.trim());
    if (lines.length > 1) {
        const firstLine = lines[0].trim();
        const parts = firstLine.split(',');
        if (parts.length === 2 || parts.length === 3) {
            return { format: 'raw', type: 'poly' };
        }
    }
    
    const parts = trimmed.split(',');
    if (parts.length === 4 || parts.length === 6) {
        return { format: 'raw', type: 'area' };
    }
    
    return { format: 'raw', type: 'area' };
}

