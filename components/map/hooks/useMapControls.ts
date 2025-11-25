import { useRef, useCallback, useEffect } from 'react';
import type { BaseMapInstance } from '../BaseMap';
import { GridControl } from '@/lib/map/controls/GridControl';
import { TileGridControl } from '@/lib/map/controls/TileGridControl';
import { RegionLabelsControl } from '@/lib/map/controls/RegionLabelsCanvas';
import { PlaneControl } from '@/lib/map/controls/PlaneControl';
import { CoordinatesControl } from '@/lib/map/controls/CoordinatesControl';
import { RegionBaseCoordinatesControl } from '@/lib/map/controls/RegionBaseCoordinatesControl';
import { RegionLookupControl } from '@/lib/map/controls/RegionLookupControl';
import { CollectionControl } from '@/lib/map/controls/CollectionControl';

interface UseMapControlsProps {
    compact: boolean;
    showRegionGrid: boolean;
    showTileGrid: boolean;
    showLabels: boolean;
    setZoom: (zoom: number) => void;
}

export function useMapControls({
    compact,
    showRegionGrid,
    showTileGrid,
    showLabels,
    setZoom,
}: UseMapControlsProps) {
    const gridControlRef = useRef<GridControl | null>(null);
    const tileGridControlRef = useRef<TileGridControl | null>(null);
    const labelsControlRef = useRef<RegionLabelsControl | null>(null);
    const planeControlRef = useRef<PlaneControl | null>(null);
    const coordinatesControlRef = useRef<CoordinatesControl | null>(null);
    const regionBaseCoordinatesControlRef = useRef<RegionBaseCoordinatesControl | null>(null);
    const regionLookupControlRef = useRef<RegionLookupControl | null>(null);
    const collectionControlRef = useRef<CollectionControl | null>(null);
    const mapInstanceRef = useRef<BaseMapInstance | null>(null);

    // Initialize controls when map is ready
    const initializeControls = useCallback((map: BaseMapInstance) => {
        mapInstanceRef.current = map;

        // Only add controls if not in compact mode
        if (!compact) {
            // Add our GridControl plugin (hidden, controlled via React)
            const gridControl = new GridControl({ position: 'bottomleft' });
            gridControl.addTo(map);
            gridControlRef.current = gridControl;

            // Add TileGridControl plugin
            const tileGridControl = new TileGridControl({ position: 'bottomleft' });
            tileGridControl.addTo(map);
            tileGridControlRef.current = tileGridControl;

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
        }

        // Update zoom state when map zooms (only if not compact)
        if (!compact) {
            const updateZoom = () => {
                setZoom(map.getZoom());
            };
            map.on('zoomend', updateZoom);
            updateZoom(); // Set initial zoom
        }
    }, [compact, setZoom]);

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
        if (!tileGridControlRef.current) return;
        const control = tileGridControlRef.current;
        const isEnabled = control.isEnabled();
        
        if (showTileGrid !== isEnabled) {
            control.setEnabled(showTileGrid);
        }
    }, [showTileGrid]);

    useEffect(() => {
        if (!labelsControlRef.current) return;
        const control = labelsControlRef.current;
        const isVisible = control.isVisible();
        
        if (showLabels !== isVisible) {
            control.setVisible(showLabels);
        }
    }, [showLabels]);

    // Cleanup controls when component unmounts
    useEffect(() => {
        return () => {
            const map = mapInstanceRef.current;
            if (!map) return;

            if (gridControlRef.current) {
                map.removeControl(gridControlRef.current);
            }
            if (tileGridControlRef.current) {
                map.removeControl(tileGridControlRef.current);
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
            if (collectionControlRef.current) {
                map.removeControl(collectionControlRef.current);
            }
        };
    }, []);

    return {
        gridControlRef,
        tileGridControlRef,
        labelsControlRef,
        planeControlRef,
        coordinatesControlRef,
        regionBaseCoordinatesControlRef,
        regionLookupControlRef,
        collectionControlRef,
        initializeControls,
    };
}

