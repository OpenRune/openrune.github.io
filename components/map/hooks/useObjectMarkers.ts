import { useCallback, useEffect, useRef } from 'react';
import L from 'leaflet';
import type { BaseMapInstance } from '../BaseMap';
import { Position } from '@/lib/map/model/Position';
import type { ObjectPosition } from '../ObjectFinder';

interface UseObjectMarkersProps {
    mapInstanceRef: React.MutableRefObject<BaseMapInstance | null>;
    objectPositions: ObjectPosition[];
    currentObjectIndex: number;
    plane: number;
    shouldFitBoundsRef: React.MutableRefObject<boolean>;
}

export function useObjectMarkers({
    mapInstanceRef,
    objectPositions,
    currentObjectIndex,
    plane,
    shouldFitBoundsRef,
}: UseObjectMarkersProps) {
    const objectMarkersRef = useRef<L.FeatureGroup | null>(null);
    const objectMarkerLayerRef = useRef<Map<number, L.Marker>>(new Map());

    // Initialize markers layer
    useEffect(() => {
        if (mapInstanceRef.current && !objectMarkersRef.current) {
            const objectMarkers = L.featureGroup();
            objectMarkers.addTo(mapInstanceRef.current);
            objectMarkersRef.current = objectMarkers;
        }
    }, [mapInstanceRef]);

    // Update object markers when positions/index/plane changes
    const updateObjectMarkers = useCallback(() => {
        if (!mapInstanceRef.current || !objectMarkersRef.current) return;

        const map = mapInstanceRef.current;
        const markerGroup = objectMarkersRef.current;
        const bounds = map.getBounds();
        if (!bounds) return; // Map not fully initialized yet
        
        // Clear existing markers from map (but keep references) only when not in highlight mode
        if (!shouldFitBoundsRef.current) {
            markerGroup.clearLayers();
        }

        // Get viewport bounds for culling - large padding to prevent pop-in
        // Calculate padding based on zoom level for better buffer at different zoom levels
        const currentZoom = map.getZoom();
        // Increased padding significantly - ranges from 0.2 to 0.5 lat/lng degrees
        const zoomBasedPadding = Math.max(0.2, 0.5 / Math.pow(1.3, currentZoom - 7)); // Much more padding at all zoom levels
        const viewportPadding = zoomBasedPadding;
        
        // Create/update markers only for visible positions
        objectPositions.forEach((pos, index) => {
            // Only show markers on the current plane
            if (pos.z !== plane) return;

            const position = new Position(pos.x, pos.y, pos.z);
            const latLng = position.toLatLng(map);
            
            // Viewport culling: only show markers in viewport (with padding)
            const paddedBounds = L.latLngBounds(
                [bounds.getSouth() - viewportPadding, bounds.getWest() - viewportPadding],
                [bounds.getNorth() + viewportPadding, bounds.getEast() + viewportPadding]
            );
            
            if (!paddedBounds.contains(latLng)) {
                // Marker is outside viewport - remove if it exists
                const existingMarker = objectMarkerLayerRef.current.get(index);
                if (existingMarker && markerGroup.hasLayer(existingMarker)) {
                    markerGroup.removeLayer(existingMarker);
                }
                return;
            }

            const isSelected = index === currentObjectIndex;

            // Check if marker already exists
            let marker = objectMarkerLayerRef.current.get(index);
            
            if (!marker) {
                // Create new marker
                const icon = L.divIcon({
                    className: 'object-marker',
                    html: `<div style="
                        width: 20px;
                        height: 20px;
                        background: ${isSelected ? '#ff4444' : '#33b5e5'};
                        border: 3px solid white;
                        border-radius: 50%;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                        cursor: pointer;
                        ${isSelected ? 'animation: pulse 2s infinite;' : ''}
                    "></div>`,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                });

                marker = L.marker(latLng, { icon });
                objectMarkerLayerRef.current.set(index, marker);
            } else {
                // Update existing marker position and icon if selected state changed
                marker.setLatLng(latLng);
                
                // Update icon if selection state changed
                const currentIcon = marker.getIcon() as L.DivIcon;
                const currentHtml = currentIcon.options.html as string;
                const shouldBeSelected = isSelected;
                const isCurrentlySelected = currentHtml.includes('#ff4444');
                
                if (shouldBeSelected !== isCurrentlySelected) {
                    const newIcon = L.divIcon({
                        className: 'object-marker',
                        html: `<div style="
                            width: 20px;
                            height: 20px;
                            background: ${isSelected ? '#ff4444' : '#33b5e5'};
                            border: 3px solid white;
                            border-radius: 50%;
                            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                            cursor: pointer;
                            ${isSelected ? 'animation: pulse 2s infinite;' : ''}
                        "></div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    });
                    marker.setIcon(newIcon);
                }
            }
            
            // Add to map if not already added
            if (!markerGroup.hasLayer(marker)) {
                marker.addTo(markerGroup);
            }
        });

        // Fit bounds to show all markers only when new search results arrive
        const visibleMarkers = objectPositions.filter(pos => pos.z === plane);
        if (shouldFitBoundsRef.current && visibleMarkers.length > 0 && markerGroup.getLayers().length > 0) {
            try {
                const allBounds = markerGroup.getBounds();
                if (allBounds.isValid()) {
                    map.fitBounds(allBounds.pad(0.1), { maxZoom: 11 });
                }
            } catch (e) {
                // Ignore bounds errors
            }
            shouldFitBoundsRef.current = false;
        }
    }, [mapInstanceRef, objectPositions, currentObjectIndex, plane, shouldFitBoundsRef]);

    // Update markers when positions/index/plane changes
    useEffect(() => {
        updateObjectMarkers();
    }, [updateObjectMarkers]);

    // Update markers when viewport changes (move/zoom)
    useEffect(() => {
        if (!mapInstanceRef.current) return;
        
        const map = mapInstanceRef.current;
        
        const handleViewportChange = () => {
            updateObjectMarkers();
        };
        
        // Throttle viewport updates for performance
        let updateTimer: NodeJS.Timeout | null = null;
        const throttledUpdate = () => {
            if (updateTimer) clearTimeout(updateTimer);
            updateTimer = setTimeout(handleViewportChange, 100); // Update every 100ms max
        };
        
        map.on('moveend', throttledUpdate);
        map.on('zoomend', throttledUpdate);
        map.on('move', throttledUpdate); // Also update during movement for smoother experience
        
        return () => {
            map.off('moveend', throttledUpdate);
            map.off('zoomend', throttledUpdate);
            map.off('move', throttledUpdate);
            if (updateTimer) clearTimeout(updateTimer);
        };
    }, [mapInstanceRef, updateObjectMarkers]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (objectMarkersRef.current && mapInstanceRef.current) {
                mapInstanceRef.current.removeLayer(objectMarkersRef.current);
                objectMarkersRef.current = null;
            }
            objectMarkerLayerRef.current.clear();
        };
    }, [mapInstanceRef]);

    return { objectMarkersRef, objectMarkerLayerRef };
}

