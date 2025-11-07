'use strict';

import * as L from 'leaflet';
import { Position } from '../model/Position';
import { Region } from '../model/Region';

export class RegionBaseCoordinatesControl extends L.Control {
    private mapRef?: L.Map & { plane?: number };

    constructor(options: L.ControlOptions = {}) {
        super({ position: options.position || 'topleft' });
    }

    onAdd(map: L.Map & { plane?: number }): HTMLElement {
        this.mapRef = map;

        // Create minimal container (required by Leaflet Control interface)
        // Container is hidden since we use React UI instead of Leaflet controls
        const container = L.DomUtil.create('div') as HTMLDivElement;
        container.style.display = 'none';

        return container;
    }

    goToRegionBaseCoordinates(rx: number, ry: number): void {
        const map = this.mapRef;
        if (!map) return;

        // Validate inputs
        if (isNaN(rx) || isNaN(ry)) return;

        // RX and RY are the offset within the region (0-63)
        // We need to find which region we're currently in, then calculate the actual coordinates
        // For now, let's get the current position and calculate from that
        const currentCenter = map.getBounds().getCenter();
        const currentPos = Position.fromLatLng(map, currentCenter, map.plane ?? 0);
        const currentRegion = Region.fromPosition(currentPos);
        const regionBasePos = currentRegion.toPosition();
        
        // Calculate target coordinates: region base + offset
        const targetX = regionBasePos.x + Math.round(rx);
        const targetY = regionBasePos.y + Math.round(ry);
        const targetZ = map.plane ?? 0;

        // Navigate to the calculated position
        const targetPos = new Position(targetX, targetY, targetZ);
        const targetLatLng = targetPos.toCentreLatLng(map);
        map.panTo(targetLatLng);
    }

    goToRegionByBaseCoordinates(regionBaseX: number, regionBaseY: number): void {
        const map = this.mapRef;
        if (!map) return;

        // Validate inputs
        if (isNaN(regionBaseX) || isNaN(regionBaseY)) return;

        // Navigate to the center of the region at these base coordinates
        const regionBasePos = new Position(Math.round(regionBaseX), Math.round(regionBaseY), map.plane ?? 0);
        const region = Region.fromPosition(regionBasePos);
        const centerPos = region.toCentrePosition();
        centerPos.z = map.plane ?? 0;
        
        const centerLatLng = centerPos.toCentreLatLng(map);
        map.panTo(centerLatLng);
    }
}