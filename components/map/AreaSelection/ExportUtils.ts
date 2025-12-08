import { CollectionControl } from '@/lib/map/controls/CollectionControl';
import { HD117AreasConverter } from '@/lib/map/converters/117hd/HD117AreasConverter';
import { ExportFormat } from './types';

const converters = {
    '117HD': {
        areas_converter: new HD117AreasConverter(),
    },
};

export function exportAllItems(
    collectionControl: CollectionControl,
    format: ExportFormat
): string {
    const areas = collectionControl.getAreas();
    const polyPositions = collectionControl.getPolyArea();
    const pathPositions = collectionControl.getPath();
    
    if (format === 'json') {
        const exportData: {
            areas?: Array<{ minX: number; minY: number; maxX: number; maxY: number; plane: number }>;
            polygon?: Array<{ x: number; y: number; z: number }>;
            path?: Array<[number, number] | [number, number, number]>;
        } = {};
        
        if (areas.length > 0) {
            exportData.areas = areas.map(area => {
                const minX = Math.min(area.startPosition.x, area.endPosition.x);
                const maxX = Math.max(area.startPosition.x, area.endPosition.x);
                const minY = Math.min(area.startPosition.y, area.endPosition.y);
                const maxY = Math.max(area.startPosition.y, area.endPosition.y);
                return {
                    minX,
                    minY,
                    maxX,
                    maxY,
                    plane: area.startPosition.z
                };
            });
        }
        
        if (polyPositions.length > 0) {
            exportData.polygon = polyPositions.map(pos => ({
                x: pos.x,
                y: pos.y,
                z: pos.z
            }));
        }
        
        if (pathPositions.length > 0) {
            exportData.path = pathPositions.map(pos => 
                pos.z > 0 ? [pos.x, pos.y, pos.z] : [pos.x, pos.y]
            );
        }
        
        return JSON.stringify(exportData, null, 2);
    } else if (format === 'array') {
        const parts: string[] = [];
        
        if (areas.length > 0) {
            areas.forEach(area => {
                const minX = Math.min(area.startPosition.x, area.endPosition.x);
                const maxX = Math.max(area.startPosition.x, area.endPosition.x);
                const minY = Math.min(area.startPosition.y, area.endPosition.y);
                const maxY = Math.max(area.startPosition.y, area.endPosition.y);
                const plane = area.startPosition.z;
                parts.push(plane > 0 
                    ? `[ ${minX}, ${minY}, ${plane}, ${maxX}, ${maxY}, ${plane} ]`
                    : `[ ${minX}, ${minY}, ${maxX}, ${maxY} ]`
                );
            });
        }
        
        if (polyPositions.length > 0) {
            polyPositions.forEach(pos => {
                parts.push(pos.z > 0 
                    ? `[ ${pos.x}, ${pos.y}, ${pos.z} ]`
                    : `[ ${pos.x}, ${pos.y} ]`
                );
            });
        }
        
        if (pathPositions.length > 0) {
            pathPositions.forEach(pos => {
                parts.push(pos.z > 0 
                    ? `[ ${pos.x}, ${pos.y}, ${pos.z} ]`
                    : `[ ${pos.x}, ${pos.y} ]`
                );
            });
        }
        
        return parts.join(',\n');
    } else if (format === 'raw') {
        const parts: string[] = [];
        
        if (areas.length > 0) {
            areas.forEach(area => {
                const minX = Math.min(area.startPosition.x, area.endPosition.x);
                const maxX = Math.max(area.startPosition.x, area.endPosition.x);
                const minY = Math.min(area.startPosition.y, area.endPosition.y);
                const maxY = Math.max(area.startPosition.y, area.endPosition.y);
                const plane = area.startPosition.z;
                parts.push(plane > 0 
                    ? `${minX},${minY},${plane},${maxX},${maxY},${plane}`
                    : `${minX},${minY},${maxX},${maxY}`
                );
            });
        }
        
        if (polyPositions.length > 0) {
            polyPositions.forEach(pos => {
                parts.push(pos.z > 0 
                    ? `${pos.x},${pos.y},${pos.z}`
                    : `${pos.x},${pos.y}`
                );
            });
        }
        
        if (pathPositions.length > 0) {
            pathPositions.forEach(pos => {
                parts.push(pos.z > 0 
                    ? `${pos.x},${pos.y},${pos.z}`
                    : `${pos.x},${pos.y}`
                );
            });
        }
        
        return parts.join('\n');
    } else if (format === 'java') {
        const parts: string[] = [];
        
        if (areas.length > 0) {
            const converter = converters['117HD'].areas_converter;
            areas.forEach(area => {
                const singleArea = converter.toJavaSingle(area);
                const values = singleArea.replace(/[\[\]]/g, '');
                parts.push(`new AABB(${values})`);
            });
        }
        
        if (polyPositions.length > 0) {
            const polyAsString = polyPositions.map(pos => 
                `new WorldPoint(${pos.x}, ${pos.y}, ${pos.z})`
            ).join(',\n    ');
            parts.push(`new WorldPoint[] {\n    ${polyAsString}\n}`);
        }
        
        if (pathPositions.length > 0) {
            const pathAsString = pathPositions.map(pos => 
                `new WorldPoint(${pos.x}, ${pos.y}, ${pos.z})`
            ).join(',\n    ');
            parts.push(`new WorldPoint[] {\n    ${pathAsString}\n}`);
        }
        
        return parts.join(',\n');
    }
    
    return '';
}

