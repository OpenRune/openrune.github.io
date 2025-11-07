'use strict';

import * as L from 'leaflet';

export class PlaneControl extends L.Control {
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

    setPlane(plane: number): void {
        if (!this.mapRef) return;
        if (plane < 0 || plane > 4) return;

        this.mapRef.plane = plane;
        this.mapRef.updateMapPath?.();
        this._dispatchPlaneChangedEvent(this.mapRef);
    }

    changePlane(delta: number): void {
        if (!this.mapRef) return;
        if (this.mapRef.plane == null) this.mapRef.plane = 0;

        const newPlane = this.mapRef.plane + delta;
        if (newPlane < 0 || newPlane > 4) return;

        this.setPlane(newPlane);
    }

    getPlane(): number {
        return this.mapRef?.plane ?? 0;
    }

    private _dispatchPlaneChangedEvent(map: L.Map & { plane?: number }) {
        map.fire('planeChanged', { plane: map.plane ?? 0 });
    }
}