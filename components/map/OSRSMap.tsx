import { useEffect, useRef, useState } from 'react';
import type { LeafletMouseEvent, Map as LeafletMap, TileLayer } from 'leaflet';
import L from 'leaflet';
import { MAX_X, MAX_Y, MIN_X, MIN_Y, Region, REGION_HEIGHT, REGION_WIDTH } from '@/lib/map/model/Region';
import { Position } from '@/lib/map/model/Position';
import { MapInfoPanel } from './MapInfoPanel';
import { MapControls } from './MapControls';
import 'leaflet/dist/leaflet.css';
import { GridControl } from '@/lib/map/controls/GridControl';
import {RegionLabelsControl} from "@/lib/map/controls/RegionLabelsCanvas";
import {PlaneControl} from "@/lib/map/controls/PlaneControl";
import {CoordinatesControl} from "@/lib/map/controls/CoordinatesControl";
import {RegionBaseCoordinatesControl} from "@/lib/map/controls/RegionBaseCoordinatesControl";
import {RegionLookupControl} from "@/lib/map/controls/RegionLookupControl";
import { useSidebar } from "@/components/ui/sidebar";
import { ObjectPosition } from './ObjectFinder';
import { AreaSelection } from './AreaSelection';
import { CollectionControl } from '@/lib/map/controls/CollectionControl';


const OSRSMap: React.FC = () => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<LeafletMap & { plane: number; tile_layer?: TileLayer; updateMapPath?: () => void } | null>(null);
    const prevMouseRectRef = useRef<L.Rectangle | null>(null);
    const prevMousePosRef = useRef<Position | null>(null);

    const [plane, setPlane] = useState<number>(0);
    const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
    const [zoom, setZoom] = useState<number>(7);
    const [showRegionGrid, setShowRegionGrid] = useState<boolean>(false);
    const [showLabels, setShowLabels] = useState<boolean>(false);
    const { state } = useSidebar();

    const gridControlRef = useRef<GridControl | null>(null);
    const labelsControlRef = useRef<RegionLabelsControl | null>(null);
    const planeControlRef = useRef<PlaneControl | null>(null);
    const coordinatesControlRef = useRef<CoordinatesControl | null>(null);
    const regionBaseCoordinatesControlRef = useRef<RegionBaseCoordinatesControl | null>(null);
    const regionLookupControlRef = useRef<RegionLookupControl | null>(null);
    const collectionControlRef = useRef<CollectionControl | null>(null);

    // Initialize map
    useEffect(() => {
        if (!mapRef.current || typeof window === 'undefined' || mapInstanceRef.current) return;

        const map = L.map(mapRef.current, { zoomControl: false, renderer: L.canvas() }) as L.Map & { plane: number; tile_layer?: TileLayer; updateMapPath?: () => void };
        map.plane = plane;

        // Update map tiles
        map.updateMapPath = function () {
            if (map.tile_layer) map.removeLayer(map.tile_layer);
            map.tile_layer = L.tileLayer(
                `api/map/{z}/${map.plane}_{x}_{y}.png`,
                {
                    minZoom: 7,
                    maxZoom: 11,
                    attribution: 'Map data',
                    noWrap: true,
                    tms: true,
                    // Performance optimizations for Firefox
                    updateWhenIdle: false,
                    updateWhenZooming: false,
                    keepBuffer: 4
                }
            );
            map.tile_layer.addTo(map);
            map.invalidateSize();
        };
        map.updateMapPath();
        map.getContainer().focus();

        // Mouse hover highlight
        map.on('mousemove', (e: LeafletMouseEvent) => {
            const mousePos = Position.fromLatLng(map, e.latlng, map.plane);
            if (!prevMousePosRef.current || !prevMousePosRef.current.equals(mousePos)) {
                prevMousePosRef.current = mousePos;
                setCurrentPosition(mousePos);

                if (prevMouseRectRef.current) map.removeLayer(prevMouseRectRef.current);
                const mouseRect = mousePos.toLeaflet(map);
                prevMouseRectRef.current = mouseRect;
                mouseRect.addTo(map);
            }
        });

        map.getContainer().addEventListener('mouseleave', () => {
            const centre = map.getBounds().getCenter();
            const centrePos = Position.fromLatLng(map, centre, map.plane);
            setCurrentPosition(centrePos);

            prevMousePosRef.current = null;
            if (prevMouseRectRef.current) {
                map.removeLayer(prevMouseRectRef.current);
                prevMouseRectRef.current = null;
            }
        });

        // Center from URL
        const currentUrl = new URL(window.location.href);
        const urlCentreX = currentUrl.searchParams.get("centreX");
        const urlCentreY = currentUrl.searchParams.get("centreY");
        const urlCentreZ = currentUrl.searchParams.get("centreZ");
        const urlZoom = currentUrl.searchParams.get("zoom");
        const urlRegionID = currentUrl.searchParams.get("regionID");

        let initialZoom = urlZoom ? Number(urlZoom) : 7;
        let centreLatLng: [number, number] = [-79, -137];

        if (urlCentreX && urlCentreY && urlCentreZ) {
            const centrePos = new Position(Number(urlCentreX), Number(urlCentreY), Number(urlCentreZ));
            centreLatLng = centrePos.toLatLng(map);
        } else if (urlRegionID) {
            const region = new Region(Number(urlRegionID));
            const centrePos = region.toCentrePosition();
            centreLatLng = centrePos.toLatLng(map);
            initialZoom = urlZoom ? Number(urlZoom) : 9;
        }

        // Add our GridControl plugin (hidden, controlled via React)
        const gridControl = new GridControl({ position: 'bottomleft' });
        gridControl.addTo(map);
        gridControlRef.current = gridControl;

        const planeControl = new PlaneControl({ position: 'bottomleft' });
        planeControl.addTo(map);
        planeControlRef.current = planeControl;

        const regionLabelsControl = new RegionLabelsControl({ position: 'bottomleft' });
        regionLabelsControl.addTo(map);
        labelsControlRef.current = regionLabelsControl;

        const coordinatesControl = new CoordinatesControl({ position: 'bottomleft' });
        coordinatesControl.addTo(map);
        coordinatesControlRef.current = coordinatesControl;

        const regionBaseCoordinatesControl = new RegionBaseCoordinatesControl({ position: 'bottomleft' });
        regionBaseCoordinatesControl.addTo(map);
        regionBaseCoordinatesControlRef.current = regionBaseCoordinatesControl;

        const regionLookupControl = new RegionLookupControl({ position: 'bottomleft' });
        regionLookupControl.addTo(map);
        regionLookupControlRef.current = regionLookupControl;

        // Add HD117 collection control
        const collectionControl = new CollectionControl({
            position: 'bottomleft'
        });
        collectionControl.addTo(map);
        collectionControlRef.current = collectionControl;

        map.setView(centreLatLng, initialZoom);
        setZoom(map.getZoom());
        setCurrentPosition(Position.fromLatLng(map, map.getBounds().getCenter(), plane));

        mapInstanceRef.current = map;

        return () => {
            if (gridControlRef.current) {
                map.removeControl(gridControlRef.current);
            }
            if (labelsControlRef.current) {
                map.removeControl(labelsControlRef.current);
            }
            if (planeControlRef.current) {
                map.removeControl(planeControlRef.current);
            }
            if (coordinatesControlRef.current) {
                map.removeControl(coordinatesControlRef.current);
            }
            if (regionBaseCoordinatesControlRef.current) {
                map.removeControl(regionBaseCoordinatesControlRef.current);
            }
            if (regionLookupControlRef.current) {
                map.removeControl(regionLookupControlRef.current);
            }
            map.remove();
            mapInstanceRef.current = null;
        };
    }, []);

    // Update plane tiles and controls
    useEffect(() => {
        if (mapInstanceRef.current && mapInstanceRef.current.updateMapPath) {
            mapInstanceRef.current.plane = plane;
            mapInstanceRef.current.updateMapPath();

            // Dispatch planeChanged event for PlaneControl (if any listeners need it)
            if (planeControlRef.current && mapInstanceRef.current) {
                mapInstanceRef.current.fire('planeChanged', { plane });
            }

            // Update controls with new plane
            if (gridControlRef.current) {
                gridControlRef.current.updatePlane();
            }
            // Trigger labels canvas redraw with new plane
            if (labelsControlRef.current) {
                labelsControlRef.current.redraw();
            }
        }
    }, [plane]);

    // Sync React state with Leaflet controls
    useEffect(() => {
        if (!gridControlRef.current) return;
        const control = gridControlRef.current;
        const isEnabled = control.isEnabled();
        
        if (showRegionGrid !== isEnabled) {
            control.setEnabled(showRegionGrid);
        }
    }, [showRegionGrid]);

    useEffect(() => {
        if (!labelsControlRef.current) return;
        const control = labelsControlRef.current;
        const isVisible = control.isVisible();
        
        if (showLabels !== isVisible) {
            control.setVisible(showLabels);
        }
    }, [showLabels]);

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


    // Update URL params
    useEffect(() => {
        if (!mapInstanceRef.current) return;
        const map = mapInstanceRef.current;

        const updateUrl = () => {
            const centre = map.getBounds().getCenter();
            const centrePos = Position.fromLatLng(map, centre, map.plane);
            const zoom = map.getZoom();
            window.history.replaceState(null, '', `?centreX=${centrePos.x}&centreY=${centrePos.y}&centreZ=${centrePos.z}&zoom=${zoom}`);
        };

        map.on('moveend', updateUrl);
        map.on('zoomend', updateUrl);

        return () => {
            map.off('moveend', updateUrl);
            map.off('zoomend', updateUrl);
        };
    }, []);

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#000' }}>
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
            <MapInfoPanel
                position={currentPosition}
                plane={plane}
                onPlaneChange={(newPlane) => {
                    setPlane(newPlane);
                    if (mapInstanceRef.current) {
                        mapInstanceRef.current.plane = newPlane;
                        mapInstanceRef.current.updateMapPath?.();
                    }
                }}
                zoom={zoom}
                onZoomChange={newZoom => {
                    if (mapInstanceRef.current) mapInstanceRef.current.setZoom(newZoom);
                    setZoom(newZoom);
                }}
                showRegionGrid={showRegionGrid}
                onShowRegionGridChange={setShowRegionGrid}
                showLabels={showLabels}
                onShowLabelsChange={setShowLabels}
                onGoToCoordinates={(x, y, z) => {
                    if (coordinatesControlRef.current) {
                        coordinatesControlRef.current.goToCoordinates(x, y, z);
                        // Update plane if different
                        if (z !== plane) {
                            setPlane(z);
                        }
                    }
                }}
                onGoToRegionCoordinates={(rx, ry) => {
                    if (regionBaseCoordinatesControlRef.current && mapInstanceRef.current) {
                        const map = mapInstanceRef.current;
                        // Get current position to determine which region we're in
                        const currentCenter = map.getBounds().getCenter();
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
                        if (centerPos.z !== plane && centerPos.z >= 0 && centerPos.z <= 4) {
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
                        // Update plane if different
                        if (position.z !== plane) {
                            setPlane(position.z);
                        }
                    }
                }}
                onObjectSearch={async (query: string, mode: 'gameval' | 'id') => {
                    // TODO: Replace with actual API call when available
                    // Mock data for UI testing
                    try {
                        // Simulate API delay
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        // Return mock data based on search query
                        const mockResults: ObjectPosition[] = [];
                        
                        if (mode === 'id') {
                            const objectId = parseInt(query);
                            if (!isNaN(objectId)) {
                                // Generate some random positions for the object ID
                                const count = Math.min(Math.floor(Math.random() * 10) + 1, 8);
                                for (let i = 0; i < count; i++) {
                                    mockResults.push({
                                        x: Math.floor(Math.random() * 3000) + 1024,
                                        y: Math.floor(Math.random() * 11000) + 1216,
                                        z: Math.floor(Math.random() * 4),
                                        objectId: objectId,
                                        gameval: `OBJ_${objectId}`
                                    });
                                }
                            }
                        } else {
                            // Gameval mode - generate some mock results
                            const queryLower = query.toLowerCase();
                            const matches = [
                                { gameval: 'BANK_BOOTH', id: 10355, count: 5 },
                                { gameval: 'CHEST', id: 375, count: 8 },
                                { gameval: 'DOOR', id: 1535, count: 12 },
                                { gameval: 'TREE', id: 1278, count: 15 },
                                { gameval: 'ROCK', id: 11161, count: 10 },
                                { gameval: 'STAIRS', id: 16671, count: 7 },
                                { gameval: 'LADDER', id: 16680, count: 6 },
                                { gameval: 'ALTAR', id: 409, count: 4 },
                                { gameval: 'ANVIL', id: 2097, count: 3 },
                                { gameval: 'FURNACE', id: 11666, count: 6 },
                            ].filter(item => item.gameval.toLowerCase().includes(queryLower));
                            
                            matches.forEach(match => {
                                for (let i = 0; i < match.count; i++) {
                                    mockResults.push({
                                        x: Math.floor(Math.random() * 3000) + 1024,
                                        y: Math.floor(Math.random() * 11000) + 1216,
                                        z: Math.floor(Math.random() * 4),
                                        objectId: match.id,
                                        gameval: match.gameval
                                    });
                                }
                            });
                            
                            // If no matches, create some generic results
                            if (mockResults.length === 0) {
                                for (let i = 0; i < 3; i++) {
                                    mockResults.push({
                                        x: Math.floor(Math.random() * 3000) + 1024,
                                        y: Math.floor(Math.random() * 11000) + 1216,
                                        z: Math.floor(Math.random() * 4),
                                        objectId: 1000 + i,
                                        gameval: query.toUpperCase()
                                    });
                                }
                            }
                        }
                        
                        return mockResults;
                    } catch (error) {
                        console.error('Object search error:', error);
                        return [];
                    }
                }}
                collectionControl={collectionControlRef.current}
            >
                <AreaSelection 
                    collectionControl={collectionControlRef.current}
                    onJumpToPosition={(position) => {
                        if (mapInstanceRef.current) {
                            const latLng = position.toCentreLatLng(mapInstanceRef.current);
                            mapInstanceRef.current.panTo(latLng);
                            // Update plane if different
                            if (position.z !== plane) {
                                setPlane(position.z);
                            }
                        }
                    }}
                    onItemClick={(item) => {
                        console.log('Area/Poly clicked:', item);
                    }}
                />
            </MapControls>
        </div>
    );
};

export default OSRSMap;