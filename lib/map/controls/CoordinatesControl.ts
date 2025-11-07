'use strict';

import * as L from 'leaflet';
import { Position } from '../model/Position';

export class CoordinatesControl extends L.Control {
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

    goToCoordinates(x: number, y: number, z: number): void {
        const map = this.mapRef;
        if (!map) return;

        // Validate inputs
        if (isNaN(x) || isNaN(y) || isNaN(z)) return;
        if (z < 0 || z > 4) return; // Z must be 0-4

        // Remove existing marker
        if (this.searchMarker) {
            map.removeLayer(this.searchMarker);
            this.searchMarker = undefined;
        }

        const pos = new Position(Math.round(x), Math.round(y), Math.round(z));
        this.searchMarker = L.marker(pos.toCentreLatLng(map), {
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
        if (map.plane !== z) {
            map.plane = z;
            map.updateMapPath?.();
            map.fire('planeChanged', { plane: z });
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