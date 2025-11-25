'use strict';

import * as L from 'leaflet';
import { Position } from '../model/Position';
import { MIN_X, MAX_X, MIN_Y, MAX_Y } from '../model/Region';

export class TileGridControl extends L.Control {
    private _gridFeatureGroup!: L.FeatureGroup<L.Polyline>;
    private _enabled: boolean = false;
    private _mapRef!: L.Map;
    private _currentZoom: number = 0;
    private _color: string;
    private _alpha: number;
    private _iconName: string = 'Grid'; // Default icon name

    constructor(options?: L.ControlOptions) {
        super(options);
        // Load color and alpha from localStorage on initialization
        if (typeof window !== 'undefined') {
            this._color = localStorage.getItem('tile-grid-color') || '#888888';
            const savedAlpha = localStorage.getItem('tile-grid-alpha');
            this._alpha = savedAlpha ? parseFloat(savedAlpha) : 0.4;
        } else {
            this._color = '#888888';
            this._alpha = 0.4;
        }
    }

    onAdd(map: L.Map): HTMLElement {
        this._mapRef = map;
        this._currentZoom = map.getZoom();

        // Create minimal container (required by Leaflet Control interface)
        // Container is hidden since we use React UI instead of Leaflet controls
        const container = L.DomUtil.create('div') as HTMLDivElement;
        container.style.display = 'none';

        // Create the initial grid feature (will be recreated with correct color when enabled)
        this._gridFeatureGroup = this._createGridFeature(map);

        // Listen to zoom and move changes to update grid
        map.on('zoomend', this._onZoomChange, this);
        map.on('moveend', this._onMoveChange, this);
        map.on('planeChanged', this._onPlaneChange, this);

        return container;
    }

    onRemove(): void {
        const map = this._mapRef;
        if (map) {
            map.off('zoomend', this._onZoomChange, this);
            map.off('moveend', this._onMoveChange, this);
            map.off('planeChanged', this._onPlaneChange, this);
        }
    }

    private _onZoomChange = (): void => {
        const map = this._mapRef;
        if (!map) return;

        const newZoom = map.getZoom();
        if (newZoom === this._currentZoom) return;

        this._currentZoom = newZoom;

        // Recreate grid with new zoom level
        const wasEnabled = this._enabled;
        if (wasEnabled) {
            map.removeLayer(this._gridFeatureGroup);
        }

        this._gridFeatureGroup = this._createGridFeature(map);

        if (wasEnabled) {
            map.addLayer(this._gridFeatureGroup);
        }
    };

    private _onMoveChange = (): void => {
        // Recreate grid when map moves to show grid lines in new viewport
        if (!this._enabled) return;
        
        const map = this._mapRef;
        if (!map) return;

        map.removeLayer(this._gridFeatureGroup);
        this._gridFeatureGroup = this._createGridFeature(map);
        map.addLayer(this._gridFeatureGroup);
    };

    private _onPlaneChange = (): void => {
        // Recreate grid when plane changes
        const map = this._mapRef;
        if (!map) return;

        const wasEnabled = this._enabled;
        if (wasEnabled) {
            map.removeLayer(this._gridFeatureGroup);
        }

        this._gridFeatureGroup = this._createGridFeature(map);

        if (wasEnabled) {
            map.addLayer(this._gridFeatureGroup);
        }
    };

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
            // Recreate grid with current color/alpha settings when enabling
            // This ensures the saved color is applied even if grid was created with defaults
            map.removeLayer(this._gridFeatureGroup);
            this._gridFeatureGroup = this._createGridFeature(map);
            map.addLayer(this._gridFeatureGroup);
        } else {
            map.removeLayer(this._gridFeatureGroup);
        }

        this._enabled = enabled;
    }

    private _createGridFeature(map: L.Map): L.FeatureGroup<L.Polyline> {
        const gridFeatureGroup = new L.FeatureGroup<L.Polyline>();
        const plane = (map as any).plane || 0;

        // Always show individual tile boundaries (1x1 tiles), matching the cursor
        // Uses the same coordinate calculations as Position.toLatLng (which the cursor uses)
        const tileSpacing = 1;

        // Get viewport bounds to only draw grid lines in visible area
        const bounds = map.getBounds();
        if (!bounds) {
            return gridFeatureGroup;
        }

        // Convert bounds to game coordinates using the same method as Position.fromLatLng
        const sw = Position.fromLatLng(map, bounds.getSouthWest(), plane);
        const ne = Position.fromLatLng(map, bounds.getNorthEast(), plane);

        // Calculate visible range with padding (show a bit more than viewport)
        const padding = 5; // Add some padding tiles
        const minX = Math.max(MIN_X, Math.floor(sw.x) - padding);
        const maxX = Math.min(MAX_X, Math.ceil(ne.x) + padding);
        const minY = Math.max(MIN_Y, Math.floor(sw.y) - padding);
        const maxY = Math.min(MAX_Y, Math.ceil(ne.y) + padding);

        // Draw vertical lines (using same coordinate conversion as Position.toLatLng)
        for (let x = minX; x <= maxX; x += tileSpacing) {
            // Use Position.toLatLng which uses the same calculations as the cursor
            const startLatLng = Position.toLatLng(map, x, minY);
            const endLatLng = Position.toLatLng(map, x, maxY);

            const line = L.polyline([startLatLng, endLatLng], {
                color: this._color,
                weight: 0.5,
                opacity: this._alpha,
                interactive: false
            });
            gridFeatureGroup.addLayer(line);
        }

        // Draw horizontal lines (using same coordinate conversion as Position.toLatLng)
        for (let y = minY; y <= maxY; y += tileSpacing) {
            // Use Position.toLatLng which uses the same calculations as the cursor
            const startLatLng = Position.toLatLng(map, minX, y);
            const endLatLng = Position.toLatLng(map, maxX, y);

            const line = L.polyline([startLatLng, endLatLng], {
                color: this._color,
                weight: 0.5,
                opacity: this._alpha,
                interactive: false
            });
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

    updateZoom(): void {
        // Trigger zoom update manually if needed
        this._onZoomChange();
    }

    setColor(color: string): void {
        this._color = color;
        // Always recreate grid with new color if it exists
        // This ensures the grid uses the correct color even if not yet enabled
        const map = this._mapRef;
        if (map && this._gridFeatureGroup) {
            const wasEnabled = this._enabled;
            if (wasEnabled) {
                map.removeLayer(this._gridFeatureGroup);
            }
            this._gridFeatureGroup = this._createGridFeature(map);
            if (wasEnabled) {
                map.addLayer(this._gridFeatureGroup);
            }
        }
    }

    getColor(): string {
        return this._color;
    }

    setAlpha(alpha: number): void {
        this._alpha = Math.max(0, Math.min(1, alpha)); // Clamp between 0 and 1
        // Always recreate grid with new alpha if it exists
        // This ensures the grid uses the correct alpha even if not yet enabled
        const map = this._mapRef;
        if (map && this._gridFeatureGroup) {
            const wasEnabled = this._enabled;
            if (wasEnabled) {
                map.removeLayer(this._gridFeatureGroup);
            }
            this._gridFeatureGroup = this._createGridFeature(map);
            if (wasEnabled) {
                map.addLayer(this._gridFeatureGroup);
            }
        }
    }

    getAlpha(): number {
        return this._alpha;
    }

    setIcon(iconName: string): void {
        this._iconName = iconName;
    }

    getIcon(): string {
        return this._iconName;
    }
}

