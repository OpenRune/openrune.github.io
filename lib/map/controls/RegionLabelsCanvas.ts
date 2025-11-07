'use strict';

import { Position } from '../model/Position';
import {
    Region,
    MIN_X,
    MAX_X,
    MIN_Y,
    MAX_Y,
    REGION_WIDTH,
    REGION_HEIGHT
} from '../model/Region';
import * as L from 'leaflet';

export class RegionLabelsCanvas extends L.Layer {
    private map?: L.Map;
    private paneName: string;
    private canvas?: HTMLCanvasElement;
    private ctx?: CanvasRenderingContext2D;

    constructor(options: L.LayerOptions & { pane?: string } = {}) {
        super();
        this.paneName = options.pane || 'overlayPane';
    }

    onAdd(map: L.Map): this {
        this.map = map;

        // Create canvas for rendering region labels
        this.canvas = L.DomUtil.create('canvas', 'region-labels-canvas') as HTMLCanvasElement;
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.imageRendering = 'crisp-edges';

        const pane = map.getPane(this.paneName) || map.getPanes().overlayPane;
        pane.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d')!;
        map.on('move zoom resize', this._reset, this);

        this._reset();
        return this;
    }

    onRemove(map: L.Map): this {
        // Clean up event handlers and remove canvas
        map.off('move zoom resize', this._reset, this);
        if (this.canvas?.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        this.map = undefined;
        return this;
    }

    private _reset() {
        if (!this.map || !this.canvas || !this.ctx) return;
        const map = this.map;
        const ctx = this.ctx;

        const size = map.getSize();
        const bounds = map.getPixelBounds();
        const topLeft = map.containerPointToLayerPoint([0, 0]);

        // Resize and position canvas
        L.DomUtil.setPosition(this.canvas, topLeft);
        this.canvas.width = size.x;
        this.canvas.height = size.y;

        ctx.clearRect(0, 0, size.x, size.y);

        // --- Font Scaling ---
        const zoom = map.getZoom();
        const baseFontSize = 10;
        const scaleFactor = Math.pow(1.3, zoom);
        const fontSize = Math.min(36, Math.max(8, baseFontSize * scaleFactor)); // clamp 8–36 px
        const opacity = Math.min(1, Math.max(0.3, zoom / 6)); // fade at low zoom

        ctx.font = `${fontSize}px Calibri`;
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(0, 0, 0, ${opacity})`;

        // --- Draw visible region labels ---
        const plane = (map as any).plane || 0;
        for (let x = MIN_X; x < MAX_X; x += REGION_WIDTH) {
            for (let y = MIN_Y; y < MAX_Y; y += REGION_HEIGHT) {
                const position = new Position(x + REGION_WIDTH / 2, y + REGION_HEIGHT / 2, plane);
                const latLng = position.toCentreLatLng(map);

                if (!map.getBounds().contains(latLng)) continue;

                const point = map.latLngToLayerPoint(latLng);
                const px = point.x - topLeft.x;
                const py = point.y - topLeft.y;

                const region = Region.fromPosition(position);

                // Outline + text for visibility
                ctx.strokeText(region.id.toString(), px, py);
                ctx.fillText(region.id.toString(), px, py);
            }
        }
    }
}

// -----------------------------
// Toggle Control
// -----------------------------
export class RegionLabelsControl extends L.Control {
    private visible = false;
    private canvasLayer?: RegionLabelsCanvas;
    private mapRef?: L.Map;

    constructor(options: L.ControlOptions = {}) {
        super({ position: options.position || 'topleft' });
    }

    onAdd(map: L.Map): HTMLElement {
        this.mapRef = map;
        map.createPane('region-labels');

        // Create minimal container (required by Leaflet Control interface)
        // Container is hidden since we use React UI instead of Leaflet controls
        const container = L.DomUtil.create('div') as HTMLDivElement;
        container.style.display = 'none';

        this.canvasLayer = new RegionLabelsCanvas({ pane: 'region-labels' });
        map.addLayer(this.canvasLayer);
        map.getPane('region-labels')!.style.display = 'none';

        return container;
    }

    toggle(): boolean {
        if (!this.mapRef) return this.visible;
        const pane = this.mapRef.getPane('region-labels');
        if (!pane) return this.visible;

        pane.style.display = this.visible ? 'none' : '';
        this.visible = !this.visible;
        return this.visible;
    }

    isVisible(): boolean {
        return this.visible;
    }

    setVisible(visible: boolean): void {
        if (!this.mapRef) return;
        const pane = this.mapRef.getPane('region-labels');
        if (!pane) return;

        pane.style.display = visible ? '' : 'none';
        this.visible = visible;
    }

    redraw(): void {
        if (this.canvasLayer) {
            (this.canvasLayer as any)._reset();
        }
    }
}