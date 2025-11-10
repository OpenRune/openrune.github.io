import { CollectionControl } from '@/lib/map/controls/CollectionControl';
import { toast } from 'sonner';

const SKIP_AREAS = new Set(['MAINLAND_EXTENSIONS', 'OVERWORLD']);

export function parseAndImport117HD(
    text: string,
    collectionControl: CollectionControl | null | undefined,
    onImportModeChange?: (isImportMode: boolean) => void
) {
    if (!collectionControl || !text.trim()) return;
    
    try {
        const rawText = text.trim();
        let parsed: any;
        try {
            parsed = JSON.parse(rawText);
        } catch (initialError) {
            const candidate = `[${rawText.replace(/,\s*$/, '')}]`;
            try {
                parsed = JSON.parse(candidate);
            } catch (wrappedError) {
                throw initialError;
            }
        }
        const parsedArray = Array.isArray(parsed) ? parsed : [parsed];

        if (!Array.isArray(parsedArray) || parsedArray.length === 0) {
            throw new Error('117HD format must contain at least one area object');
        }

        const convertRegionBoxToAabb = (box: number[]): number[] | null => {
            if (!Array.isArray(box) || box.length === 0) {
                return null;
            }

            const from = box[0];
            const to = box.length > 1 ? box[1] : box[0];

            if (typeof from !== 'number' || typeof to !== 'number' || Number.isNaN(from) || Number.isNaN(to)) {
                return null;
            }

            let x1 = from >>> 8;
            let y1 = from & 0xFF;
            let x2 = to >>> 8;
            let y2 = to & 0xFF;

            if (x1 > x2) [x1, x2] = [x2, x1];
            if (y1 > y2) [y1, y2] = [y2, y1];

            const minX = x1 << 6;
            const minY = y1 << 6;
            const maxX = ((x2 + 1) << 6) - 1;
            const maxY = ((y2 + 1) << 6) - 1;

            return [minX, minY, maxX, maxY];
        };
        
        const areaMap = new Map<string, any>();
        parsedArray.forEach(item => {
            if (item.name) {
                areaMap.set(item.name, item);
            }
        });
        
        const resolveAreas = (areaName: string, visited: Set<string>): any[] => {
            if (visited.has(areaName)) {
                return [];
            }
            visited.add(areaName);
            
            const areaDef = areaMap.get(areaName);
            if (!areaDef) {
                return [];
            }
            
            const resolved: any[] = [];
            
            if (areaDef.areas && Array.isArray(areaDef.areas)) {
                areaDef.areas.forEach((refName: string) => {
                    const refAreas = resolveAreas(refName, new Set(visited));
                    resolved.push(...refAreas);
                });
            }
            
            if (areaDef.aabbs && Array.isArray(areaDef.aabbs)) {
                resolved.push({
                    name: areaDef.name,
                    aabbs: areaDef.aabbs
                });
            }

            if (areaDef.regionBoxes && Array.isArray(areaDef.regionBoxes)) {
                resolved.push({
                    name: areaDef.name,
                    regionBoxes: areaDef.regionBoxes
                });
            }
            
            return resolved;
        };
        
        const allAABBs: number[][] = [];
        
        parsedArray.forEach(item => {
            if (item.name && SKIP_AREAS.has(item.name)) {
                return;
            }
            
            if (item.areas && Array.isArray(item.areas) && item.areas.length > 0) {
                const resolved = resolveAreas(item.name, new Set());
                resolved.forEach(resolvedItem => {
                    if (resolvedItem.name && SKIP_AREAS.has(resolvedItem.name)) {
                        return;
                    }
                    
                    if (resolvedItem.aabbs && Array.isArray(resolvedItem.aabbs)) {
                        resolvedItem.aabbs.forEach((aabb: number[]) => {
                            allAABBs.push(aabb);
                        });
                    }

                    if (resolvedItem.regionBoxes && Array.isArray(resolvedItem.regionBoxes)) {
                        resolvedItem.regionBoxes.forEach((box: number[]) => {
                            const converted = convertRegionBoxToAabb(box);
                            if (converted) {
                                allAABBs.push(converted);
                            }
                        });
                    }
                });
                
                if (item.aabbs && Array.isArray(item.aabbs) && item.aabbs.length > 0) {
                    item.aabbs.forEach((aabb: number[]) => {
                        allAABBs.push(aabb);
                    });
                }
                if (item.regionBoxes && Array.isArray(item.regionBoxes) && item.regionBoxes.length > 0) {
                    item.regionBoxes.forEach((box: number[]) => {
                        const converted = convertRegionBoxToAabb(box);
                        if (converted) {
                            allAABBs.push(converted);
                        }
                    });
                }
            } else if (item.aabbs && Array.isArray(item.aabbs) && item.aabbs.length > 0) {
                item.aabbs.forEach((aabb: number[]) => {
                    allAABBs.push(aabb);
                });
            } else if (item.regionBoxes && Array.isArray(item.regionBoxes) && item.regionBoxes.length > 0) {
                item.regionBoxes.forEach((box: number[]) => {
                    const converted = convertRegionBoxToAabb(box);
                    if (converted) {
                        allAABBs.push(converted);
                    }
                });
            }
        });
        
        if (allAABBs.length > 0) {
            const aabbsStr = allAABBs.map(aabb => `[${aabb.join(',')}]`).join(', ');
            const convertedText = `"aabbs": [${aabbsStr}]`;
            
            collectionControl.importFromText(convertedText, 'area');
            
            if (onImportModeChange) {
                onImportModeChange(false);
            }
            toast.success(`Imported ${allAABBs.length} areas from 117HD format`);
        } else {
            throw new Error('No areas found in 117HD format');
        }
    } catch (error) {
        toast.error(`Failed to import 117HD format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export function parseAndImportNormal(
    text: string,
    format: 'json' | 'java' | 'array' | 'raw',
    type: 'area' | 'poly',
    collectionControl: CollectionControl | null | undefined,
    onImportModeChange?: (isImportMode: boolean) => void
) {
    if (!collectionControl || !text.trim()) return;
    
    try {
        if (type === 'poly' && (format === 'raw' || format === 'array')) {
            let rawText = text;
            
            if (format === 'array') {
                try {
                    const parsed = JSON.parse(text.trim());
                    if (Array.isArray(parsed)) {
                        rawText = parsed.map((arr: any[]) => {
                            if (Array.isArray(arr)) {
                                return arr.join(',');
                            }
                            return arr;
                        }).join('\n');
                    }
                } catch (e) {
                    // Already in raw format or can't parse, use as-is
                }
            }
            
            (collectionControl as any).importPolygonFromRaw(rawText);
            if (onImportModeChange) {
                onImportModeChange(false);
            }
            toast.success('Imported polygon successfully');
            return;
        }
        
        let convertedText = text;
        
        if (format === 'json') {
            const parsed = JSON.parse(text.trim());
            if (type === 'area') {
                if (parsed.areas && Array.isArray(parsed.areas)) {
                    const aabbs = parsed.areas.map((area: any) => {
                        const minX = area.minX ?? area.x ?? 0;
                        const minY = area.minY ?? area.y ?? 0;
                        const maxX = area.maxX ?? (area.x != null ? (area.x + (area.width ?? 0)) : 0);
                        const maxY = area.maxY ?? (area.y != null ? (area.y + (area.height ?? 0)) : 0);
                        const plane = area.plane ?? area.z ?? 0;
                        
                        if (plane > 0) {
                            return [minX, minY, plane, maxX, maxY, plane];
                        }
                        return [minX, minY, maxX, maxY];
                    });
                    const aabbsStr = aabbs.map((arr: number[]) => `[${arr.join(',')}]`).join(', ');
                    convertedText = `"aabbs": [${aabbsStr}]`;
                } else if (parsed.aabbs && Array.isArray(parsed.aabbs)) {
                    const aabbsStr = parsed.aabbs.map((arr: number[]) => `[${arr.join(',')}]`).join(', ');
                    convertedText = `"aabbs": [${aabbsStr}]`;
                } else if (parsed.minX !== undefined || parsed.x !== undefined) {
                    const minX = parsed.minX ?? parsed.x ?? 0;
                    const minY = parsed.minY ?? parsed.y ?? 0;
                    const maxX = parsed.maxX ?? (parsed.x != null ? (parsed.x + (parsed.width ?? 0)) : 0);
                    const maxY = parsed.maxY ?? (parsed.y != null ? (parsed.y + (parsed.height ?? 0)) : 0);
                    const plane = parsed.plane ?? parsed.z ?? 0;
                    
                    const aabb = plane > 0
                        ? [minX, minY, plane, maxX, maxY, plane]
                        : [minX, minY, maxX, maxY];
                    convertedText = `"aabbs": [[${aabb.join(',')}]]`;
                } else {
                    throw new Error('Invalid JSON format. Expected "areas" array or "aabbs" array, or area object with minX/minY/maxX/maxY');
                }
            } else if (type === 'poly') {
                const positions = parsed.positions || parsed.polygon || (Array.isArray(parsed) ? parsed : []);
                const rawText = positions.map((pos: any) => {
                    if (typeof pos === 'object' && ('x' in pos || 'X' in pos)) {
                        const x = pos.x ?? pos.X;
                        const y = pos.y ?? pos.Y;
                        const z = pos.z ?? pos.Z ?? 0;
                        return `${x},${y},${z}`;
                    } else if (Array.isArray(pos)) {
                        return pos.join(',');
                    }
                    return pos;
                }).filter(Boolean).join('\n');
                
                (collectionControl as any).importPolygonFromRaw(rawText);
                if (onImportModeChange) {
                    onImportModeChange(false);
                }
                toast.success('Imported polygon successfully');
                return;
            }
        } else if (format === 'array') {
            if (type === 'area') {
                let parsed: any;
                let parsedAsJson = false;
                
                try {
                    parsed = JSON.parse(text.trim());
                    parsedAsJson = true;
                } catch (e) {
                    parsedAsJson = false;
                }
                
                if (!parsedAsJson) {
                    const arrayRegex = /\[([^\]]+)\]/g;
                    const arrays: number[][] = [];
                    let match;
                    
                    while ((match = arrayRegex.exec(text)) !== null) {
                        const values = match[1].split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
                        if (values.length === 4 || values.length === 6) {
                            arrays.push(values);
                        }
                    }
                    
                    if (arrays.length > 0) {
                        const aabbsStr = arrays.map(arr => `[${arr.join(',')}]`).join(', ');
                        convertedText = `"aabbs": [${aabbsStr}]`;
                    } else {
                        throw new Error('Could not parse array format. Expected: [minX, minY, maxX, maxY]');
                    }
                } else {
                    if (Array.isArray(parsed)) {
                        if (parsed.length > 0 && Array.isArray(parsed[0])) {
                            const aabbsStr = parsed.map((arr: number[]) => `[${arr.join(',')}]`).join(', ');
                            convertedText = `"aabbs": [${aabbsStr}]`;
                        } else if (parsed.every((v: any) => typeof v === 'number')) {
                            convertedText = `"aabbs": [[${parsed.join(',')}]]`;
                        } else {
                            throw new Error('Invalid array format');
                        }
                    } else {
                        throw new Error('Expected array format');
                    }
                }
            }
        } else if (format === 'raw') {
            const lines = text.trim().split(/\r?\n/).filter(line => line.trim());
            const aabbs: number[][] = [];
            
            for (const line of lines) {
                const cleanedLine = line.trim().replace(/,$/, '');
                const parts = cleanedLine.split(',').map(p => p.trim()).filter(p => p);
                const numbers = parts.map(p => parseInt(p)).filter(n => !isNaN(n));
                
                if (numbers.length === 4) {
                    aabbs.push(numbers);
                } else if (numbers.length === 6) {
                    aabbs.push(numbers);
                }
            }
            
            if (aabbs.length > 0) {
                const aabbsStr = aabbs.map(arr => `[${arr.join(',')}]`).join(', ');
                convertedText = `"aabbs": [${aabbsStr}]`;
            } else {
                throw new Error('Invalid raw format. Expected lines like: minX,minY,maxX,maxY or minX,minY,plane,maxX,maxY,plane');
            }
        } else if (format === 'java') {
            const aabbRegex = /new\s+AABB\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d+)\s*,\s*(\d+))?\s*\)/g;
            const aabbs: number[][] = [];
            let match;
            
            while ((match = aabbRegex.exec(text)) !== null) {
                const p1 = parseInt(match[1]);
                const p2 = parseInt(match[2]);
                const p3 = parseInt(match[3]);
                const p4 = parseInt(match[4]);
                const p5 = match[5] ? parseInt(match[5]) : undefined;
                const p6 = match[6] ? parseInt(match[6]) : undefined;
                
                if (p5 !== undefined && p6 !== undefined) {
                    aabbs.push([p1, p2, p3, p4, p5, p6]);
                } else {
                    aabbs.push([p1, p2, p3, p4]);
                }
            }
            
            if (aabbs.length > 0) {
                const aabbsStr = aabbs.map(arr => `[${arr.join(',')}]`).join(', ');
                convertedText = `"aabbs": [${aabbsStr}]`;
            } else {
                throw new Error('Could not parse Java AABB format. Expected: new AABB(minX, minY, maxX, maxY)');
            }
        }
        
        if (!convertedText) {
            throw new Error('Could not parse input in the selected format');
        }
        
        collectionControl.importFromText(convertedText, type);
        
        if (onImportModeChange) {
            onImportModeChange(false);
        }
        toast.success(`Imported ${type} successfully`);
    } catch (error) {
        toast.error(`Failed to import: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

