'use strict';

import * as L from 'leaflet';
import { Position } from '../model/Position';
import { Region, MIN_X, MAX_X, MIN_Y, MAX_Y } from '../model/Region';

export class RegionLookupControl extends L.Control {
    private searchMarker?: L.Marker;
    private mapRef?: L.Map & { plane?: number; updateMapPath?: () => void };

    constructor(options: L.ControlOptions = {}) {
        super({ position: options.position || 'topleft' });
    }

    onAdd(map: L.Map & { plane?: number; updateMapPath?: () => void }): HTMLElement {
        this.mapRef = map;

        // Create minimal container (required by Leaflet Control interface)
        // Container is hidden since we use React UI instead of Leaflet controls
        const container = L.DomUtil.create('div') as HTMLDivElement;
        container.style.display = 'none';

        return container;
    }

    goToRegion(regionID: number): void {
        const map = this.mapRef;
        if (!map) return;

        // Validate input
        if (isNaN(regionID)) return;

        const region = new Region(regionID);
        const position = region.toCentrePosition();

        // Validate position is within bounds
        if (position.x < MIN_X || position.x > MAX_X || position.y < MIN_Y || position.y > MAX_Y) {
            return;
        }

        this._goToCoordinates(position);
    }

    private _goToCoordinates(position: Position): void {
        const map = this.mapRef;
        if (!map) return;

        // Remove existing marker
        if (this.searchMarker) {
            map.removeLayer(this.searchMarker);
            this.searchMarker = undefined;
        }

        this.searchMarker = L.marker(position.toCentreLatLng(map), {
            icon: L.icon({
                iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIuNSAwQzUuNiAwIDAgNS42IDAgMTIuNUMwIDIxIDEyLjUgNDEgMTIuNSA0MVMxNSAyMSAxNSAxMi41QzE1IDUuNiA5LjQgMCAxMi41IDBaIiBmaWxsPSIjMzc4MkQ0Ii8+PC9zdmc+',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
            })
        });

        // Remove on click
        this.searchMarker.once('click', () => {
            if (this.searchMarker) {
                map.removeLayer(this.searchMarker);
                this.searchMarker = undefined;
            }
        });

        this.searchMarker.addTo(map);
        map.panTo(this.searchMarker.getLatLng());

        // Sync plane if different
        if (map.plane !== position.z) {
            map.plane = position.z;
            map.updateMapPath?.();
            map.fire('planeChanged', { plane: position.z });
        }
    }

    clearMarker(): void {
        if (this.searchMarker && this.mapRef) {
            this.mapRef.removeLayer(this.searchMarker);
            this.searchMarker = undefined;
        }
    }

    hasMarker(): boolean {
        return this.searchMarker !== undefined;
    }
}

