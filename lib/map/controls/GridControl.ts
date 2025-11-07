'use strict';

import * as L from 'leaflet';
import { Position } from '../model/Position';
import { REGION_WIDTH, REGION_HEIGHT, MIN_X, MAX_X, MIN_Y, MAX_Y } from '../model/Region';

export class GridControl extends L.Control {
    private _gridFeatureGroup!: L.FeatureGroup<L.Polyline>;
    private _enabled: boolean = false;
    private _mapRef!: L.Map;

    constructor(options?: L.ControlOptions) {
        super(options);
    }

    onAdd(map: L.Map): HTMLElement {
        this._mapRef = map;

        // Create minimal container (required by Leaflet Control interface)
        // Container is hidden since we use React UI instead of Leaflet controls
        const container = L.DomUtil.create('div') as HTMLDivElement;
        container.style.display = 'none';

        // Create the grid feature
        this._gridFeatureGroup = this._createGridFeature(map);

        return container;
    }

    toggle(): boolean {
        const map = this._mapRef;
        if (!map) return this._enabled;

        if (this._enabled) {
            map.removeLayer(this._gridFeatureGroup);
        } else {
            map.addLayer(this._gridFeatureGroup);
        }

        this._enabled = !this._enabled;
        return this._enabled;
    }

    isEnabled(): boolean {
        return this._enabled;
    }

    setEnabled(enabled: boolean): void {
        const map = this._mapRef;
        if (!map || this._enabled === enabled) return;

        if (enabled) {
            map.addLayer(this._gridFeatureGroup);
        } else {
            map.removeLayer(this._gridFeatureGroup);
        }

        this._enabled = enabled;
    }

    private _createGridFeature(map: L.Map): L.FeatureGroup<L.Polyline> {
        const gridFeatureGroup = new L.FeatureGroup<L.Polyline>();
        const plane = (map as any).plane || 0;

        // vertical lines
        for (let x = MIN_X; x <= MAX_X; x += REGION_WIDTH) {
            const startPos = new Position(x, MIN_Y, plane);
            const endPos = new Position(x, MAX_Y, plane);

            const line = L.polyline([startPos.toLatLng(map), endPos.toLatLng(map)], { interactive: false });
            gridFeatureGroup.addLayer(line);
        }

        // horizontal lines
        for (let y = MIN_Y; y <= MAX_Y; y += REGION_HEIGHT) {
            const startPos = new Position(MIN_X, y, plane);
            const endPos = new Position(MAX_X, y, plane);

            const line = L.polyline([startPos.toLatLng(map), endPos.toLatLng(map)], { interactive: false });
            gridFeatureGroup.addLayer(line);
        }

        return gridFeatureGroup;
    }

    updatePlane(): void {
        const map = this._mapRef;
        if (!map) return;

        const wasEnabled = this._enabled;
        if (wasEnabled) {
            map.removeLayer(this._gridFeatureGroup);
        }

        // Recreate grid with new plane
        this._gridFeatureGroup = this._createGridFeature(map);

        if (wasEnabled) {
            map.addLayer(this._gridFeatureGroup);
        }
    }
}