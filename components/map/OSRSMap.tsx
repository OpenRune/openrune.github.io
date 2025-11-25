import { useEffect, useRef, useState, useCallback, useMemo, startTransition } from 'react';
import { Region } from '@/lib/map/model/Region';
import { Position } from '@/lib/map/model/Position';
import { useGamevals, OBJTYPES } from '@/lib/gamevals';
import { MapInfoPanel } from './MapInfoPanel';
import { MapControls } from './MapControls';
import { BaseMap, BaseMapInstance } from './BaseMap';
import { useSidebar } from "@/components/ui/sidebar";
import { ObjectPosition } from './ObjectFinder';
import { AreaSelection } from './AreaSelection';
import { SelectionControls } from './SelectionControls';
import { useBlockEditor } from './useBlockEditor';
import { toast } from 'sonner';
import { useQueryExecution } from './hooks/useQueryExecution';
import { useObjectMarkers } from './hooks/useObjectMarkers';
import { useMapControls } from './hooks/useMapControls';
import { QueryBuilderButton } from './QueryBuilderButton';
import L from 'leaflet';

interface OSRSMapProps {
    initialObjectId?: number;
    compact?: boolean;
}

const DEFAULT_CENTER = { lat: -24.0, lng: 47.0 };
const DEFAULT_ZOOM = 5;
const DEFAULT_PLANE = 0;
const MAX_ZOOM = 8;
const MIN_ZOOM = 4;

const OBJECT_TYPES: Record<number, string> = {
    0: 'WallStraight',
    1: 'WallDiagonalCorner',
    2: 'WallCorner',
    3: 'WallSquareCorner',
    4: 'WallDecorStraightNoOffset',
    5: 'WallDecorStraightOffset',
    6: 'WallDecorDiagonalOffset',
    7: 'WallDecorDiagonalNoOffset',
    8: 'WallDecorDiagonalBoth',
    9: 'WallDiagonal',
    10: 'CentrepieceStraight',
    11: 'CentrepieceDiagonal',
    12: 'RoofStraight',
    13: 'RoofDiagonalWithRoofEdge',
    14: 'RoofDiagonal',
    15: 'RoofCornerConcave',
    16: 'RoofCornerConvex',
    17: 'RoofFlat',
    18: 'RoofEdgeStraight',
    19: 'RoofEdgeDiagonalCorner',
    20: 'RoofEdgeCorner',
    21: 'WallEdgeSquarecorner',
    22: 'GroundDecor',
};

const MARKER_ICON_SIZE: [number, number] = [20, 20];
const MARKER_ICON_ANCHOR: [number, number] = [10, 10];

const createMarkerIcon = (color: string, selected = false) =>
    L.divIcon({
        className: 'object-marker',
        html: `<div style="
            width: 20px;
            height: 20px;
            background: ${color};
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            cursor: pointer;
            ${selected ? 'animation: pulse 2s infinite;' : ''}
        "></div>`,
        iconSize: MARKER_ICON_SIZE,
        iconAnchor: MARKER_ICON_ANCHOR,
    });

const OSRSMap: React.FC<OSRSMapProps> = ({ initialObjectId, compact = false }) => {
    const mapInstanceRef = useRef<BaseMapInstance | null>(null);
    const [plane, setPlane] = useState<number>(0);
    const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
    const [zoom, setZoom] = useState<number>(7);
    const [showRegionGrid, setShowRegionGrid] = useState<boolean>(false);
    const [showTileGrid, setShowTileGrid] = useState<boolean>(false);
    const [showLabels, setShowLabels] = useState<boolean>(false);
    const [selectedItemType, setSelectedItemType] = useState<'area' | 'poly' | 'path' | null>(null);
    const [objectPositions, setObjectPositions] = useState<ObjectPosition[]>([]);
    const [currentObjectIndex, setCurrentObjectIndex] = useState<number>(-1);
    const [objectSearchQuery, setObjectSearchQuery] = useState<string>('');
    const [queryResults, setQueryResults] = useState<any[]>([]);
    const [resultsFormat, setResultsFormat] = useState<'table' | 'json' | 'list'>('table');
    const [showResultsInSettings, setShowResultsInSettings] = useState<boolean>(false);
    const [resultsSource, setResultsSource] = useState<'display' | 'highlight' | null>(null);
    const [highlightSelectionIndex, setHighlightSelectionIndex] = useState<number>(0);
    const highlightMarkersRef = useRef<Map<number, L.Marker>>(new Map());
    const [markAllActive, setMarkAllActive] = useState<boolean>(false);
    const { lookupGameval, loadGamevalType, hasLoaded } = useGamevals();

    useEffect(() => {
        loadGamevalType(OBJTYPES).catch(console.error);
    }, [loadGamevalType]);

    const getResultExtras = useCallback((result: any) => {
        if (!result) return null;
        const name = hasLoaded(OBJTYPES) && typeof result.objectId === 'number'
            ? lookupGameval(OBJTYPES, result.objectId)
            : undefined;
        const orientation = result.orientation ?? 1;
        const imageUrl = result.objectId !== undefined
            ? `https://chisel.weirdgloop.org/static/img/osrs-object/${result.objectId}_orient${orientation}.png`
            : undefined;

        return { name, imageUrl };
    }, [lookupGameval, hasLoaded]);

    const buildMarkerTooltip = useCallback((result: any) => {
         const extras = getResultExtras(result);
         const name = extras?.name ?? `Object ${result.objectId}`;
         const coords = `(${result.x}, ${result.y}, ${result.z})`;
         const orientation = result.orientation ?? 'N/A';
         const packedValue = Position.toPacked(result.x, result.y, result.z);
         const typeName = result.type !== undefined
             ? (OBJECT_TYPES[result.type] ?? `Type ${result.type}`)
             : 'Unknown';

        const imageHtml = extras?.imageUrl
            ? `<div class="tooltip-card__image"><img src="${extras.imageUrl}" alt="${name}" onerror="this.style.display='none';" /></div>`
            : "";

        return `
            <div class="tooltip-card">
                <div class="tooltip-card__title">${name}</div>
                <div class="tooltip-card__grid">
                    <span class="tooltip-card__label">Coords</span><span>${coords}</span>
                    <span class="tooltip-card__label">Packed</span><span>${packedValue}</span>
                    <span class="tooltip-card__label">Object ID</span><span>${result.objectId ?? 'N/A'}</span>
                    <span class="tooltip-card__label">Orientation</span><span>${orientation}</span>
                    <span class="tooltip-card__label">Type</span><span>${typeName}</span>
                </div>
                ${imageHtml}
            </div>
        `;
    }, [getResultExtras]);

    const highlightedSingleMarkerRef = useRef<L.Marker | null>(null);
    const { state } = useSidebar();
    const hasSearchedInitialObjectRef = useRef<boolean>(false);
    const shouldFitBoundsRef = useRef<boolean>(false);
    const isInternalPlaneUpdateRef = useRef(false);

    const markerIcons = useMemo(() => ({
        default: createMarkerIcon('#33b5e5'),
        selected: createMarkerIcon('#ff4444', true),
    }), []);

    // Use map controls hook
    const {
        gridControlRef,
        tileGridControlRef,
        labelsControlRef,
        planeControlRef,
        coordinatesControlRef,
        regionBaseCoordinatesControlRef,
        regionLookupControlRef,
        collectionControlRef,
        initializeControls,
    } = useMapControls({
        compact,
        showRegionGrid,
        showTileGrid,
        showLabels,
        setZoom,
    });

    // Use object markers hook
    const { objectMarkersRef, objectMarkerLayerRef } = useObjectMarkers({
        mapInstanceRef,
        objectPositions,
        currentObjectIndex,
        plane,
        shouldFitBoundsRef,
    });

    // Handle results change from query execution
    const handleResultsChange = useCallback((results: any[], format: 'table' | 'json' | 'list', source: 'display' | 'highlight') => {
        startTransition(() => {
            setQueryResults(results);
            setResultsFormat(source === 'highlight' ? 'list' : format);
            setResultsSource(source);
            setShowResultsInSettings(true);
            if (source === 'highlight') {
                setHighlightSelectionIndex(0);
                setMarkAllActive(false);
            }
        });
    }, []);

    // Use query execution hook
    const { handleBlockExecute } = useQueryExecution({
        mapInstanceRef,
        objectMarkersRef,
        objectMarkerLayerRef,
        onResultsChange: handleResultsChange,
    });


    const { CommandPalette, BlockEditorComponent, openBlockEditor, isOpen: isBlockEditorOpen, setBlockEditorOpen } = useBlockEditor({
        onExecute: handleBlockExecute,
        mapInstance: mapInstanceRef.current,
    });

    const updateHighlightMarkers = useCallback((selectedIndex: number, markers?: Map<number, L.Marker>) => {
        const candidate = markers ?? (highlightMarkersRef.current.size > 0 ? highlightMarkersRef.current : objectMarkerLayerRef.current);
        if (!candidate) return;
        candidate.forEach((marker, index) => {
            if (!marker) return;
            const isSelected = index === selectedIndex;
            marker.setIcon(isSelected ? markerIcons.selected : markerIcons.default);
        });
    }, [markerIcons, objectMarkerLayerRef]);

    const clearHighlightMarkers = useCallback(() => {
        highlightMarkersRef.current.forEach((marker) => {
            marker.remove();
        });
        highlightMarkersRef.current = new Map();
        highlightedSingleMarkerRef.current?.remove();
        highlightedSingleMarkerRef.current = null;
        setMarkAllActive(false);
    }, []);

    const markResultOnMap = useCallback((result: any, index: number) => {
        if (!mapInstanceRef.current) return;
        const position = new Position(result.x, result.y, result.z);
        const latLng = position.toCentreLatLng(mapInstanceRef.current);

        const next = markAllActive ? new Map(highlightMarkersRef.current) : new Map<number, L.Marker>();

        if (!markAllActive) {
            highlightMarkersRef.current.forEach((marker) => marker.remove());
            highlightedSingleMarkerRef.current?.remove();
            highlightedSingleMarkerRef.current = null;
        }

        let marker = next.get(index);
        if (!marker) {
            marker = L.marker(latLng, { icon: markerIcons.default });
            marker.addTo(mapInstanceRef.current!);
        } else {
            marker.setLatLng(latLng);
        }

        marker.unbindTooltip();
        marker.bindTooltip(buildMarkerTooltip(result), {
            className: 'highlight-marker-tooltip',
            direction: 'top',
            offset: [0, -16],
            opacity: 1,
            permanent: false,
            sticky: false,
        });

        next.set(index, marker);
        if (!markAllActive) {
            highlightedSingleMarkerRef.current = marker;
        }

        highlightMarkersRef.current = next;
    }, [markAllActive, buildMarkerTooltip, markerIcons, mapInstanceRef]);

    const markAllResults = useCallback(() => {
        if (!mapInstanceRef.current) return;
        clearHighlightMarkers();
        highlightedSingleMarkerRef.current?.remove();
        highlightedSingleMarkerRef.current = null;
        const markers = new Map<number, L.Marker>();

        queryResults.forEach((result, index) => {
            const position = new Position(result.x, result.y, result.z);
            const latLng = position.toCentreLatLng(mapInstanceRef.current!);
            const marker = L.marker(latLng, { icon: markerIcons.default });
            marker.addTo(mapInstanceRef.current!);
            marker.bindTooltip(buildMarkerTooltip(result), {
                className: 'highlight-marker-tooltip',
                direction: 'top',
                offset: [0, -16],
                opacity: 1,
                permanent: false,
                sticky: false,
            });
            markers.set(index, marker);
        });

        highlightMarkersRef.current = markers;
        setMarkAllActive(true);
        updateHighlightMarkers(highlightSelectionIndex, markers);
    }, [clearHighlightMarkers, queryResults, highlightSelectionIndex, updateHighlightMarkers, buildMarkerTooltip, markerIcons]);

    const unmarkAllResults = useCallback(() => {
        clearHighlightMarkers();
        highlightedSingleMarkerRef.current?.remove();
        highlightedSingleMarkerRef.current = null;
        setMarkAllActive(false);
    }, [clearHighlightMarkers]);

    useEffect(() => {
        if (resultsSource === 'highlight') {
            updateHighlightMarkers(highlightSelectionIndex);
        }
    }, [highlightSelectionIndex, resultsSource, updateHighlightMarkers]);

    const handleResultSelect = useCallback((result: any) => {
        if (!mapInstanceRef.current) return;
        const position = new Position(result.x, result.y, result.z);
        const latLng = position.toCentreLatLng(mapInstanceRef.current);
        mapInstanceRef.current.panTo(latLng);
        if (result.z !== plane && result.z >= 0 && result.z <= 3) {
            setPlane(result.z);
        }
        markResultOnMap(result, highlightSelectionIndex);
    }, [plane, markResultOnMap, highlightSelectionIndex]);

    useEffect(() => {
        if (showResultsInSettings && resultsSource === 'display') {
            setBlockEditorOpen(true);
        }
    }, [showResultsInSettings, resultsSource, setBlockEditorOpen]);

    useEffect(() => {
        if (!isBlockEditorOpen && resultsSource !== 'highlight') {
            setShowResultsInSettings(false);
            setResultsSource(null);
        }
    }, [isBlockEditorOpen, resultsSource]);

    // Initialize controls when map is ready
    const handleMapReady = useCallback((map: BaseMapInstance) => {
        mapInstanceRef.current = map;

        // Sync initial plane state from map
        isInternalPlaneUpdateRef.current = true;
        setPlane(map.plane);
        isInternalPlaneUpdateRef.current = false;

        // Initialize map controls
        initializeControls(map);

        // Initialize object markers layer (always needed for object location)
        if (!objectMarkersRef.current) {
            const objectMarkers = L.featureGroup();
            objectMarkers.addTo(map);
            objectMarkersRef.current = objectMarkers;
        }

        // If we have an initial object ID, search for it once map is ready
        if (initialObjectId && !hasSearchedInitialObjectRef.current) {
            hasSearchedInitialObjectRef.current = true;
            
            const fetchObjectLocations = async () => {
                try {
                    const response = await fetch(`/api/map/objects/${initialObjectId}`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.locations && data.locations.length > 0) {
                            const positions: ObjectPosition[] = data.locations.map((loc: any) => ({
                                x: loc.position.x,
                                y: loc.position.y,
                                z: loc.position.z,
                                objectId: loc.id,
                                orientation: loc.orientation,
                            }));
                            
                            setObjectPositions(positions);
                            setObjectSearchQuery(initialObjectId.toString());
                            shouldFitBoundsRef.current = true;
                            
                            // Show toast notification with count (like ObjectFinder does)
                            if (positions.length > 0) {
                                toast.success(`Found ${positions.length} object${positions.length > 1 ? 's' : ''}`, {
                                    description: `Object ID: ${initialObjectId}`
                                });
                            }
                            
                            // Wait a bit for map to settle, then jump to first result
                            setTimeout(() => {
                                if (mapInstanceRef.current && positions.length > 0) {
                                    const firstPos = new Position(positions[0].x, positions[0].y, positions[0].z);
                                    const latLng = firstPos.toCentreLatLng(mapInstanceRef.current);
                                    mapInstanceRef.current.panTo(latLng);
                                    
                                    if (positions[0].z !== map.plane && positions[0].z >= 0 && positions[0].z <= 3) {
                                        setPlane(positions[0].z);
                                    }
                                    
                                    setCurrentObjectIndex(0);
                                }
                            }, 300);
                        } else {
                            toast.error(`No locations found for object ID ${initialObjectId}`);
                        }
                    } else {
                        toast.error(`Failed to fetch object ${initialObjectId}`);
                    }
                } catch (error) {
                    console.error('Error fetching object locations:', error);
                    toast.error(`Error fetching object ${initialObjectId}`);
                }
            };
            
            fetchObjectLocations();
        }

        // Cleanup function will be handled by BaseMap
    }, [initialObjectId, compact, initializeControls]);

    // Update plane when it changes externally (from OSRSMap controls)
    useEffect(() => {
        // Skip if this is an internal update from BaseMap
        if (isInternalPlaneUpdateRef.current) return;

        if (mapInstanceRef.current && mapInstanceRef.current.plane !== plane) {
            // Update map plane via BaseMap's setPlane method if available
            const setPlaneMethod = (mapInstanceRef.current as any).setPlane;
            if (setPlaneMethod) {
                setPlaneMethod(plane);
            } else {
                // Fallback: directly update if setPlane not available yet
            mapInstanceRef.current.plane = plane;
                mapInstanceRef.current.updateMapPath?.();
            }

            // Dispatch planeChanged event for PlaneControl
            if (planeControlRef.current && mapInstanceRef.current) {
                mapInstanceRef.current.fire('planeChanged', { plane });
            }

            // Update controls with new plane
            if (gridControlRef.current) {
                gridControlRef.current.updatePlane();
            }
            if (tileGridControlRef.current) {
                tileGridControlRef.current.updatePlane();
            }
            // Trigger labels canvas redraw with new plane
            if (labelsControlRef.current) {
                labelsControlRef.current.redraw();
            }
        }
    }, [plane]);

    // Reset search ref when initialObjectId changes (so new searches work)
    useEffect(() => {
        if (initialObjectId !== undefined) {
            hasSearchedInitialObjectRef.current = false;
        }
    }, [initialObjectId]);


    // Invalidate map size when sidebar state changes (to handle resize)
    useEffect(() => {
        if (mapInstanceRef.current) {
            // Use a small delay to ensure the container has resized
            const timer = setTimeout(() => {
                if (mapInstanceRef.current) {
                    mapInstanceRef.current.invalidateSize();
                }
            }, 250); // Slightly longer than the transition duration (200ms)

            return () => clearTimeout(timer);
        }
    }, [state]);


    // Keyboard controls for moving selected areas
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle arrow keys when map is focused or no input is focused
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
                return;
            }

            if (!collectionControlRef.current) return;
            
            const selected = collectionControlRef.current.getSelectedItem();
            if (!selected.type) return;

            let moved = false;
            let dx = 0;
            let dy = 0;

            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    dy = 1; // Move up (increase Y - north in game coordinates)
                    moved = true;
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    dy = -1; // Move down (decrease Y - south in game coordinates)
                    moved = true;
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    dx = -1; // Move left (decrease X)
                    moved = true;
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    dx = 1; // Move right (increase X)
                    moved = true;
                    break;
            }

            if (moved && collectionControlRef.current) {
                if (selected.type === 'area' && selected.index !== null) {
                    collectionControlRef.current.moveSelectedArea(dx, dy);
                } else if (selected.type === 'poly') {
                    collectionControlRef.current.moveSelectedPolyArea(dx, dy);
                }
                // Note: Path movement not yet implemented in CollectionControl
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);


    // Handle plane changes from BaseMap (e.g., from URL params)
    const handlePlaneChange = useCallback((newPlane: number) => {
        if (!isInternalPlaneUpdateRef.current && newPlane !== plane) {
            isInternalPlaneUpdateRef.current = true;
            setPlane(newPlane);
            isInternalPlaneUpdateRef.current = false;
        }
    }, [plane]);

    return (
        <>
            <BaseMap
                onMapReady={handleMapReady}
                onPositionChange={setCurrentPosition}
                onPlaneChange={handlePlaneChange}
                initialPlane={plane}
                showCoordinates={compact}
                showFullscreen={false}
            >
                {!compact && (
                    <>
            <MapInfoPanel
                position={currentPosition}
                plane={plane}
                onPlaneChange={(newPlane) => {
                    setPlane(newPlane);
                }}
                zoom={zoom}
                onZoomChange={newZoom => {
                    if (mapInstanceRef.current) mapInstanceRef.current.setZoom(newZoom);
                    setZoom(newZoom);
                }}
                showRegionGrid={showRegionGrid}
                onShowRegionGridChange={setShowRegionGrid}
                showTileGrid={showTileGrid}
                onShowTileGridChange={setShowTileGrid}
                showLabels={showLabels}
                onShowLabelsChange={setShowLabels}
                tileGridControlRef={tileGridControlRef}
                onGoToCoordinates={(x, y, z) => {
                    if (coordinatesControlRef.current) {
                                    // Cap z at 3
                                    const cappedZ = Math.max(0, Math.min(3, z));
                                    coordinatesControlRef.current.goToCoordinates(x, y, cappedZ);
                        // Update plane if different
                                    if (cappedZ !== plane) {
                                        setPlane(cappedZ);
                        }
                    }
                }}
                onGoToRegionCoordinates={(rx, ry) => {
                    if (regionBaseCoordinatesControlRef.current && mapInstanceRef.current) {
                        const map = mapInstanceRef.current;
                        // Get current position to determine which region we're in
                        const bounds = map.getBounds();
                        if (!bounds) return; // Map not fully initialized yet
                        const currentCenter = bounds.getCenter();
                        const currentPos = Position.fromLatLng(map, currentCenter, map.plane);
                        const currentRegion = Region.fromPosition(currentPos);
                        const regionBasePos = currentRegion.toPosition();
                        
                        // Calculate target coordinates: region base + offset
                        const targetX = regionBasePos.x + rx;
                        const targetY = regionBasePos.y + ry;
                        
                        // Use CoordinatesControl to navigate
                        if (coordinatesControlRef.current) {
                            coordinatesControlRef.current.goToCoordinates(targetX, targetY, plane);
                        }
                    }
                }}
                onGoToRegion={(regionId) => {
                    if (regionLookupControlRef.current) {
                        regionLookupControlRef.current.goToRegion(regionId);
                        // Update plane if the region's plane is different
                        const region = new Region(regionId);
                        const centerPos = region.toCentrePosition();
                                    if (centerPos.z !== plane && centerPos.z >= 0 && centerPos.z <= 3) {
                            setPlane(centerPos.z);
                        }
                    }
                }}
                className="top-4 left-4"
            />
            <MapControls 
                combined={true}
                onJumpToPosition={(position) => {
                    if (mapInstanceRef.current) {
                        const latLng = position.toCentreLatLng(mapInstanceRef.current);
                        mapInstanceRef.current.panTo(latLng);
                                    // Update plane if different (cap at 3)
                                    if (position.z !== plane && position.z >= 0 && position.z <= 3) {
                            setPlane(position.z);
                        }
                    }
                }}
                onObjectPositionsChange={(positions) => {
                    setObjectPositions(positions);
                    // Set flag to fit bounds when new search results arrive
                    if (positions.length > 0) {
                        shouldFitBoundsRef.current = true;
                    }
                }}
                onObjectCurrentIndexChange={setCurrentObjectIndex}
                            onObjectSearchQueryChange={setObjectSearchQuery}
                            objectSearchQuery={objectSearchQuery}
                            objectPositions={objectPositions}
                            objectCurrentIndex={currentObjectIndex}
                collectionControl={collectionControlRef.current}
                queryResults={queryResults}
                resultsFormat={resultsFormat}
                onResultsFormatChange={setResultsFormat}
                showQueryResults={showResultsInSettings}
                resultsSource={resultsSource}
                onCloseQueryResults={() => {
                    setShowResultsInSettings(false);
                    setResultsSource(null);
                }}
                onResultClick={handleResultSelect}
                onHighlightIndexChange={(index, result) => {
                    setHighlightSelectionIndex(index);
                    updateHighlightMarkers(index);
                    if (!markAllActive && result) {
                        markResultOnMap(result, index);
                    }
                }}
                onMarkAll={markAllResults}
                onUnmarkAll={unmarkAllResults}
                markAllActive={markAllActive}
                getResultExtras={getResultExtras}
            >
                <AreaSelection 
                    collectionControl={collectionControlRef.current}
                    onJumpToPosition={(position) => {
                        if (mapInstanceRef.current) {
                            const latLng = position.toCentreLatLng(mapInstanceRef.current);
                            mapInstanceRef.current.panTo(latLng);
                                        // Update plane if different (cap at 3)
                                        if (position.z !== plane && position.z >= 0 && position.z <= 3) {
                                setPlane(position.z);
                            }
                        }
                    }}
                    onItemClick={(item) => {
                        console.log('Area/Poly clicked:', item);
                    }}
                    onItemSelected={(item) => {
                        setSelectedItemType(item?.type || null);
                    }}
                />
            </MapControls>
            <SelectionControls visible={selectedItemType !== null} type={selectedItemType} />
                    </>
                )}
                {!compact && (
                    <QueryBuilderButton onClick={openBlockEditor} />
                )}
            </BaseMap>
            {!compact && (
                <>
                    <CommandPalette />
                    <BlockEditorComponent />
                </>
            )}
        </>
    );
};

export default OSRSMap;
