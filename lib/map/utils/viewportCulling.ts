import type { LatLngBounds, Map as LeafletMap } from 'leaflet';
import L from 'leaflet';
import { Position } from '../model/Position';
import { Area } from '../model/Area';

/**
 * Check if a position is within the viewport bounds
 */
export function isPositionInViewport(map: LeafletMap, position: Position, padding: number = 0): boolean {
    const bounds = map.getBounds();
    const latLng = position.toLatLng(map);
    
    // Add padding to bounds for better UX (so items appear slightly before entering viewport)
    const paddedBounds = padding > 0 
        ? L.latLngBounds(
            [bounds.getSouth() - padding, bounds.getWest() - padding],
            [bounds.getNorth() + padding, bounds.getEast() + padding]
        )
        : bounds;
    
    return paddedBounds.contains(latLng);
}

/**
 * Check if an area (rectangle) intersects with the viewport
 * @param padding - If > 1, treated as game coordinates; if < 1, treated as lat/lng degrees
 */
export function isAreaInViewport(map: LeafletMap, area: Area, padding: number = 0): boolean {
    const bounds = map.getBounds();
    
    // Convert padding from game coordinates to lat/lng if needed
    let latLngPadding: number;
    if (padding > 1) {
        // Padding is in game coordinates - convert to lat/lng
        // Get center of viewport to use as reference point
        const center = bounds.getCenter();
        const centerPos = Position.fromLatLng(map, center, (map as any).plane || 0);
        
        // Create positions offset by padding amount
        const paddedPos = new Position(centerPos.x + padding, centerPos.y + padding, centerPos.z);
        const paddedLatLng = paddedPos.toLatLng(map);
        
        // Calculate the lat/lng difference
        latLngPadding = Math.max(
            Math.abs(paddedLatLng.lat - center.lat),
            Math.abs(paddedLatLng.lng - center.lng)
        );
    } else {
        // Padding is already in lat/lng degrees
        latLngPadding = padding;
    }
    
    // Add padding to viewport bounds
    const paddedBounds = latLngPadding > 0 
        ? L.latLngBounds(
            [bounds.getSouth() - latLngPadding, bounds.getWest() - latLngPadding],
            [bounds.getNorth() + latLngPadding, bounds.getEast() + latLngPadding]
        )
        : bounds;
    
    // Get area bounds
    const areaBounds = area.toLeaflet(map).getBounds();
    
    // Check if area bounds intersect with viewport bounds
    return paddedBounds.intersects(areaBounds);
}

/**
 * Check if a polygon (array of positions) intersects with the viewport
 * @param padding - If > 1, treated as game coordinates; if < 1, treated as lat/lng degrees
 */
export function isPolygonInViewport(map: LeafletMap, positions: Position[], padding: number = 0): boolean {
    if (positions.length === 0) return false;
    
    const bounds = map.getBounds();
    
    // Convert padding from game coordinates to lat/lng if needed
    let latLngPadding: number;
    if (padding > 1) {
        // Padding is in game coordinates - convert to lat/lng
        // Get center of viewport to use as reference point
        const center = bounds.getCenter();
        const centerPos = Position.fromLatLng(map, center, (map as any).plane || 0);
        
        // Create positions offset by padding amount
        const paddedPos = new Position(centerPos.x + padding, centerPos.y + padding, centerPos.z);
        const paddedLatLng = paddedPos.toLatLng(map);
        
        // Calculate the lat/lng difference
        latLngPadding = Math.max(
            Math.abs(paddedLatLng.lat - center.lat),
            Math.abs(paddedLatLng.lng - center.lng)
        );
    } else {
        // Padding is already in lat/lng degrees
        latLngPadding = padding;
    }
    
    // Add padding to viewport bounds
    const paddedBounds = latLngPadding > 0 
        ? L.latLngBounds(
            [bounds.getSouth() - latLngPadding, bounds.getWest() - latLngPadding],
            [bounds.getNorth() + latLngPadding, bounds.getEast() + latLngPadding]
        )
        : bounds;
    
    // Check if any vertex is in viewport (quick check)
    for (const pos of positions) {
        if (isPositionInViewport(map, pos, 0)) {
            return true;
        }
    }
    
    // Check if polygon bounds intersect with viewport
    // Calculate bounding box of polygon
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    for (const pos of positions) {
        const latLng = pos.toLatLng(map);
        minLat = Math.min(minLat, latLng.lat);
        maxLat = Math.max(maxLat, latLng.lat);
        minLng = Math.min(minLng, latLng.lng);
        maxLng = Math.max(maxLng, latLng.lng);
    }
    
    const polygonBounds = L.latLngBounds([minLat, minLng], [maxLat, maxLng]);
    
    return paddedBounds.intersects(polygonBounds);
}

/**
 * Get viewport bounds as game coordinates
 */
export function getViewportBounds(map: LeafletMap, plane: number): { minX: number; maxX: number; minY: number; maxY: number } {
    const bounds = map.getBounds();
    const sw = Position.fromLatLng(map, bounds.getSouthWest(), plane);
    const ne = Position.fromLatLng(map, bounds.getNorthEast(), plane);
    
    return {
        minX: Math.min(sw.x, ne.x),
        maxX: Math.max(sw.x, ne.x),
        minY: Math.min(sw.y, ne.y),
        maxY: Math.max(sw.y, ne.y)
    };
}

