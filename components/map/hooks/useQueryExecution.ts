import { useCallback, useRef } from 'react';
import { useGamevals, OBJTYPES } from '@/lib/gamevals';
import type { BaseMapInstance } from '../BaseMap';
import type { Block } from '../NodeEditor';
import { Region } from '@/lib/map/model/Region';
import { Position } from '@/lib/map/model/Position';
import { toast } from 'sonner';
import L from 'leaflet';

type TileLookup = Map<number, Set<number>>;

function parseInteger(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value);
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') {
            return null;
        }

        const parsed = Number.parseInt(trimmed, 10);
        return Number.isNaN(parsed) ? null : parsed;
    }

    return null;
}

function resolveLocationPosition(loc: any): Position | null {
    if (!loc) {
        return null;
    }

    const rawPosition = loc.position ?? loc.pos ?? null;

    if (typeof rawPosition === 'number' || typeof rawPosition === 'string') {
        const packed =
            typeof rawPosition === 'number'
                ? rawPosition
                : Number.parseInt(rawPosition, 10);

        if (!Number.isNaN(packed)) {
            const unpacked = Position.fromPacked(packed);
            if (unpacked.x >= 0 && unpacked.y >= 0 && unpacked.z >= 0) {
                return unpacked;
            }
        }
    } else if (rawPosition && typeof rawPosition === 'object') {
        const x = parseInteger(rawPosition.x ?? rawPosition.column ?? loc.x);
        const y = parseInteger(rawPosition.y ?? rawPosition.row ?? loc.y);
        const z = parseInteger(rawPosition.z ?? loc.z ?? 0) ?? 0;

        if (x !== null && y !== null) {
            return new Position(x, y, z);
        }
    }

    const fallbackX = parseInteger(loc.x);
    const fallbackY = parseInteger(loc.y);
    if (fallbackX === null || fallbackY === null) {
        return null;
    }
    const fallbackZ = parseInteger(loc.z ?? 0) ?? 0;

    return new Position(fallbackX, fallbackY, fallbackZ);
}

function buildTileLookup(
    rawTileData: any,
    baseX: number,
    baseY: number
): TileLookup | null {
    if (!rawTileData) {
        return null;
    }

    const tileLookup: TileLookup = new Map();

    const addEntry = (packedPosition: number | null, tileId: number | null) => {
        if (packedPosition === null || tileId === null) {
            return;
        }

        if (!Number.isFinite(packedPosition)) {
            return;
        }

        if (tileId === 0) {
            return;
        }

        const normalizedPacked = packedPosition >>> 0;
        const normalizedTileId = Math.trunc(tileId);

        if (!tileLookup.has(normalizedPacked)) {
            tileLookup.set(normalizedPacked, new Set<number>());
        }

        tileLookup.get(normalizedPacked)!.add(normalizedTileId);
    };

    if (Array.isArray(rawTileData)) {
        rawTileData.forEach((planeData, plane) => {
            if (!Array.isArray(planeData)) {
                return;
            }

            planeData.forEach((column, localX) => {
                if (!Array.isArray(column)) {
                    return;
                }

                column.forEach((tileId, localY) => {
                    const normalizedTileId = parseInteger(tileId);
                    if (normalizedTileId === null || normalizedTileId === 0) {
                        return;
                    }

                    const globalX = baseX + localX;
                    const globalY = baseY + localY;
                    const packed = Position.toPacked(globalX, globalY, plane);

                    addEntry(packed, normalizedTileId);
                });
            });
        });

        return tileLookup;
    }

    if (typeof rawTileData === 'object') {
        Object.entries(rawTileData).forEach(([key, value]) => {
            const tileId = parseInteger(key);
            if (tileId === null || tileId === 0) {
                return;
            }

            if (!Array.isArray(value)) {
                return;
            }

            value.forEach((entry) => {
                const packed =
                    typeof entry === 'number'
                        ? entry
                        : parseInteger(entry);
                if (packed === null) {
                    return;
                }

                addEntry(packed, tileId);
            });
        });

        return tileLookup;
    }

    return null;
}

interface UseQueryExecutionProps {
    mapInstanceRef: React.MutableRefObject<BaseMapInstance | null>;
    objectMarkersRef: React.MutableRefObject<L.FeatureGroup | null>;
    objectMarkerLayerRef: React.MutableRefObject<Map<number, L.Marker>>;
    onResultsChange: (results: any[], format: 'table' | 'json' | 'list', source: 'display' | 'highlight') => void;
}

export function useQueryExecution({
    mapInstanceRef,
    objectMarkersRef,
    objectMarkerLayerRef,
    onResultsChange,
}: UseQueryExecutionProps) {
    const { lookupGamevalByName } = useGamevals();
    const handleBlockExecute = useCallback(async (blocks: Block[]) => {
        if (blocks.length === 0) {
            toast.error('No blocks to execute');
            return;
        }

        // Process blocks and execute query
        console.log('Executing blocks:', blocks);
        
        // Extract filters and inputs
        const filters = blocks.filter(b => b.type === 'filter');
        const inputs = blocks.filter(b => b.type === 'input');
        const outputs = blocks.filter(b => b.type === 'output');

        // Build query based on blocks
        let queryResults: any[] = [];
        let regionData: any = null; // Store region data for overlay/underlay filtering
        let overlayTileLookup: TileLookup | null = null;
        let underlayTileLookup: TileLookup | null = null;
        
        // Check if we have a region input
        const regionInput = inputs.find(i => i.category === 'region');
        const overlayFilter = filters.find(f => f.category === 'overlay');
        const underlayFilter = filters.find(f => f.category === 'underlay');
        const objectTypeFilter = filters.find(f => f.category === 'object_type');
        const objectTypeEnumFilter = filters.find(f => f.category === 'object_type_enum');
        const orientationFilter = filters.find(f => f.category === 'orientation');
        const dynamicFilter = filters.find(f => f.category === 'dynamic');
        
        // Always require a region input to query
        if (!regionInput || regionInput.data.regionId === undefined) {
            toast.error('Please add a "Select Region" block to query');
            return;
        }

        const regionId = regionInput.data.regionId;
        const region = new Region(regionId);
        const regionBasePos = region.toPosition();
        const regionBaseX = regionBasePos.x;
        const regionBaseY = regionBasePos.y;

        // Query region data
        try {
            const response = await fetch(`/api/map/regions/${regionId}`);
            if (!response.ok) {
                toast.error(`Failed to query region: ${response.statusText}`);
                return;
            }
            
            regionData = await response.json();
            overlayTileLookup = buildTileLookup(regionData.overlayIds, regionBaseX, regionBaseY);
            underlayTileLookup = buildTileLookup(regionData.underlayIds, regionBaseX, regionBaseY);
            
            // Convert positions (Location objects) to query results
            if (regionData.positions && Array.isArray(regionData.positions)) {
                queryResults = regionData.positions
                    .map((loc: any) => {
                        const position = resolveLocationPosition(loc);
                        if (!position) {
                            return null;
                        }

                        const objectId = parseInteger(loc.id);
                        const orientation = parseInteger(loc.orientation) ?? 0;
                        const typeEnum = parseInteger(loc.type) ?? 0;

                        if (objectId === null) {
                            console.warn('Skipping location with invalid object id:', loc);
                            return null;
                        }

                        return {
                            x: position.x,
                            y: position.y,
                            z: position.z,
                            objectId,
                            orientation,
                            type: typeEnum, // Object type enum (0-22)
                            isDynamic: Boolean(loc.isDynamic),
                        };
                    })
                    .filter((result: any) => result !== null);
                
                console.log('Query results parsed:', {
                    total: queryResults.length,
                    sample: queryResults.slice(0, 5),
                    planes: [...new Set(queryResults.map(r => r.z))].sort(),
                    overlayLookupTiles: overlayTileLookup?.size ?? 0,
                    underlayLookupTiles: underlayTileLookup?.size ?? 0,
                });
            } else {
                console.warn('Region data does not contain positions array:', regionData);
            }
        } catch (error) {
            console.error('Error querying region:', error);
            toast.error('Error querying region');
            return;
        }

        // Apply additional filters
        let filteredResults = queryResults;
        
        // Filter by plane (no include/exclude mode - just filter to the selected plane)
        const planeFilter = filters.find(f => f.category === 'plane');
        console.log('Filtering by plane:', {
            planeFilterFound: !!planeFilter,
            planeFilterData: planeFilter?.data,
            planeValue: planeFilter?.data?.plane,
            allFilters: filters.map(f => ({ category: f.category, data: f.data })),
        });
        
        if (planeFilter && planeFilter.data.plane !== undefined && planeFilter.data.plane !== 'all') {
            // Ensure plane is a number (could be string from Select)
            const plane = typeof planeFilter.data.plane === 'string' 
                ? parseInt(planeFilter.data.plane, 10) 
                : planeFilter.data.plane;
            
            if (isNaN(plane)) {
                console.error('Invalid plane value:', planeFilter.data.plane);
            } else {
                // Ensure result.z is a number for comparison
                filteredResults = filteredResults.filter((result: any) => {
                    const resultPlane = typeof result.z === 'number' ? result.z : parseInt(String(result.z), 10);
                    if (isNaN(resultPlane)) {
                        console.warn('Invalid result.z value:', result.z, result);
                        return false;
                    }
                    return resultPlane === plane;
                });
                
                console.log('Plane filter applied:', { 
                    planeFilterValue: planeFilter.data.plane, 
                    plane, 
                    totalResultsBefore: queryResults.length, 
                    totalResultsAfter: filteredResults.length,
                    sampleResults: filteredResults.slice(0, 3),
                });
            }
        } else {
            console.log('Plane filter not applied:', {
                hasPlaneFilter: !!planeFilter,
                planeValue: planeFilter?.data?.plane,
                reason: !planeFilter ? 'No plane filter found' : 
                        planeFilter.data.plane === undefined ? 'Plane value undefined' :
                        planeFilter.data.plane === 'all' ? 'Plane set to all' : 'Unknown reason',
            });
        }

        // Filter by dynamic state
        if (dynamicFilter && dynamicFilter.data.dynamicState) {
            const desiredDynamic = dynamicFilter.data.dynamicState === 'dynamic';
            const mode = dynamicFilter.data.mode || 'include';

            if (mode === 'include') {
                filteredResults = filteredResults.filter((result: any) => Boolean(result.isDynamic) === desiredDynamic);
            } else {
                filteredResults = filteredResults.filter((result: any) => Boolean(result.isDynamic) !== desiredDynamic);
            }
        }

        // Apply object ID filter (post-filter on results)
        // This can filter by ID (number) or gameval (string) - if gameval, we need to resolve it to ID first
        if (objectTypeFilter) {
            const mode = objectTypeFilter.data.mode || 'include';
            const objectIdOrGameval =
                objectTypeFilter.data.objectId !== undefined
                    ? objectTypeFilter.data.objectId
                    : (objectTypeFilter.data as any).objectLabel;

            if (objectIdOrGameval === undefined) {
                // Nothing to filter by
            } else if (typeof objectIdOrGameval === 'string') {
                const normalizedName = objectIdOrGameval.trim().replace(/\s+/g, '_');
                const resolvedFromCache = lookupGamevalByName(OBJTYPES, normalizedName);

                if (resolvedFromCache !== undefined) {
                    if (mode === 'include') {
                        filteredResults = filteredResults.filter((result: any) => result.objectId === resolvedFromCache);
                    } else {
                        filteredResults = filteredResults.filter((result: any) => result.objectId !== resolvedFromCache);
                    }
                } else {
                    try {
                        // Try to fetch object by gameval to get the ID
                        const params = new URLSearchParams({
                            mode: 'gameval',
                            q: normalizedName,
                            amt: '1',
                            offset: '0',
                        });
                        const response = await fetch(`/api/objects?${params.toString()}`);
                        if (response.ok) {
                            const data = await response.json();
                            if (data.results && data.results.length > 0) {
                                const resolvedId = parseInt(data.results[0].id, 10);
                                if (mode === 'include') {
                                    filteredResults = filteredResults.filter((result: any) => result.objectId === resolvedId);
                                } else {
                                    filteredResults = filteredResults.filter((result: any) => result.objectId !== resolvedId);
                                }
                            } else {
                                // Gameval not found - exclude all if include mode, include all if exclude mode
                                if (mode === 'include') {
                                    filteredResults = [];
                                }
                                // If exclude mode and gameval not found, keep all results (nothing to exclude)
                            }
                        } else {
                            // API error - show error and return empty results for include mode
                            if (mode === 'include') {
                                toast.error(`Failed to resolve gameval: ${objectIdOrGameval}`);
                                filteredResults = [];
                            }
                        }
                    } catch (error) {
                        console.error('Error resolving gameval to ID:', error);
                        if (mode === 'include') {
                            toast.error(`Error resolving gameval: ${objectIdOrGameval}`);
                            filteredResults = [];
                        }
                    }
                }
            } else {
                // It's a number (ID) - filter directly
                const objectId = parseInteger(objectIdOrGameval);
                if (objectId === null) {
                    if (mode === 'include') {
                        filteredResults = [];
                    }
                } else if (mode === 'include') {
                    filteredResults = filteredResults.filter((result: any) => result.objectId === objectId);
                } else {
                    filteredResults = filteredResults.filter((result: any) => result.objectId !== objectId);
                }
            }
        }

        // Apply object type enum filter (post-filter on results)
        if (objectTypeEnumFilter && objectTypeEnumFilter.data.objectTypeEnum !== undefined) {
            const mode = objectTypeEnumFilter.data.mode || 'include';
            const typeEnumValue = objectTypeEnumFilter.data.objectTypeEnum;
            const typeEnum = parseInteger(typeEnumValue);

            if (typeEnum === null) {
                if (mode === 'include') {
                    filteredResults = [];
                }
            } else if (mode === 'include') {
                filteredResults = filteredResults.filter((result: any) => result.type === typeEnum);
            } else {
                filteredResults = filteredResults.filter((result: any) => result.type !== typeEnum);
            }
        }

        // Apply orientation filter (post-filter on results)
        if (orientationFilter && orientationFilter.data.orientation !== undefined) {
            const mode = orientationFilter.data.mode || 'include';
            const orientationValue = orientationFilter.data.orientation;
            const orientation = parseInteger(orientationValue);

            if (orientation === null) {
                if (mode === 'include') {
                    filteredResults = [];
                }
            } else if (mode === 'include') {
                filteredResults = filteredResults.filter((result: any) => result.orientation === orientation);
            } else {
                filteredResults = filteredResults.filter((result: any) => result.orientation !== orientation);
            }
        }

        // Apply overlay filter using packed position lookups
        if (overlayFilter && overlayTileLookup) {
            const mode = overlayFilter.data.mode || 'include';
            const requestedOverlayId = overlayFilter.data.overlayId;
            const overlayIdProvided = requestedOverlayId !== undefined && requestedOverlayId !== null;
            const overlayId = overlayIdProvided ? parseInteger(requestedOverlayId) : null;
            if (overlayIdProvided && overlayId === null) {
                console.warn('Invalid overlay filter value:', requestedOverlayId);
            }

            filteredResults = filteredResults.filter((result: any) => {
                const normalizedX = parseInteger(result.x);
                const normalizedY = parseInteger(result.y);
                const normalizedZ = parseInteger(result.z ?? 0) ?? 0;

                if (normalizedX === null || normalizedY === null) {
                    return mode === 'exclude';
                }

                const packedPosition = Position.toPacked(normalizedX, normalizedY, normalizedZ) >>> 0;
                const overlayIdsAtPosition = overlayTileLookup.get(packedPosition);
                const hasOverlay = !!overlayIdsAtPosition && overlayIdsAtPosition.size > 0;

                if (!overlayIdProvided) {
                    return mode === 'include' ? hasOverlay : !hasOverlay;
                }

                if (overlayId === null) {
                    return mode === 'exclude';
                }

                const match = overlayIdsAtPosition?.has(overlayId) ?? false;
                return mode === 'include' ? match : !match;
            });
        }

        // Apply underlay filter using packed position lookups
        if (underlayFilter && underlayTileLookup) {
            const mode = underlayFilter.data.mode || 'include';
            const requestedUnderlayId = underlayFilter.data.underlayId;
            const underlayIdProvided = requestedUnderlayId !== undefined && requestedUnderlayId !== null;
            const underlayId = underlayIdProvided ? parseInteger(requestedUnderlayId) : null;
            if (underlayIdProvided && underlayId === null) {
                console.warn('Invalid underlay filter value:', requestedUnderlayId);
            }

            filteredResults = filteredResults.filter((result: any) => {
                const normalizedX = parseInteger(result.x);
                const normalizedY = parseInteger(result.y);
                const normalizedZ = parseInteger(result.z ?? 0) ?? 0;

                if (normalizedX === null || normalizedY === null) {
                    return mode === 'exclude';
                }

                const packedPosition = Position.toPacked(normalizedX, normalizedY, normalizedZ) >>> 0;
                const underlayIdsAtPosition = underlayTileLookup.get(packedPosition);
                const hasUnderlay = !!underlayIdsAtPosition && underlayIdsAtPosition.size > 0;

                if (!underlayIdProvided) {
                    return mode === 'include' ? hasUnderlay : !hasUnderlay;
                }

                if (underlayId === null) {
                    return mode === 'exclude';
                }

                const match = underlayIdsAtPosition?.has(underlayId) ?? false;
                return mode === 'include' ? match : !match;
            });
        }

        // Handle outputs
        for (const output of outputs) {
            if (output.category === 'highlight' && mapInstanceRef.current && objectMarkersRef.current) {
                // Populate markers using the shared layer so Object Finder-style icons render
                filteredResults.forEach((result: any, index: number) => {
                    const position = new Position(result.x, result.y, result.z);
                    const latLng = position.toCentreLatLng(mapInstanceRef.current);

                    let marker = objectMarkerLayerRef.current.get(index);
                    if (!marker) {
                        const icon = L.divIcon({
                            className: 'object-marker',
                            html: `<div style="
                                width: 20px;
                                height: 20px;
                                background: #33b5e5;
                                border: 3px solid white;
                                border-radius: 50%;
                                box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                                cursor: pointer;
                            "></div>`,
                            iconSize: [20, 20],
                            iconAnchor: [10, 10],
                        });
                        marker = L.marker(latLng, { icon });
                        objectMarkerLayerRef.current.set(index, marker);
                    } else {
                        marker.setLatLng(latLng);
                    }

                    if (objectMarkersRef.current && !objectMarkersRef.current.hasLayer(marker)) {
                        marker.addTo(objectMarkersRef.current);
                    }
                });

                if (filteredResults.length > 0) {
                    onResultsChange(filteredResults, 'list', 'highlight');
                }
            } else if (output.category === 'count') {
                toast.success(`Found ${filteredResults.length} result${filteredResults.length !== 1 ? 's' : ''}`);
            } else if (output.category === 'display') {
                if (filteredResults.length === 0) {
                    toast.info('No results found');
                } else {
                    // Store results and format, then open modal
                    onResultsChange(filteredResults, output.data?.format || 'table', 'display');
                }
            }
        }

        return filteredResults;
    }, [mapInstanceRef, objectMarkersRef, objectMarkerLayerRef, onResultsChange]);

    return { handleBlockExecute };
}

