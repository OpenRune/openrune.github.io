'use strict';

import { Position } from './Position';
import * as L from 'leaflet';

export class Path {
    map: L.Map;
    featureGroup: L.FeatureGroup;
    positions: Position[];
    lines: L.Polyline[];
    rectangles: L.Rectangle[];

    constructor(map: L.Map) {
        this.map = map;
        this.featureGroup = new L.FeatureGroup();
        this.positions = [];
        this.lines = [];
        this.rectangles = [];
    }

    add(position: Position): void {
        this.positions.push(position);

        const rectangle = position.toLeaflet(this.map);
        this.featureGroup.addLayer(rectangle);
        this.rectangles.push(rectangle);

        if (this.positions.length > 1) {
            const lastIndex = this.positions.length - 1;
            const line = this.createPolyline(this.positions[lastIndex - 1], this.positions[lastIndex]);
            this.lines.push(line);
            this.featureGroup.addLayer(line);
        }
    }

    removeLast(): void {
        if (this.positions.length > 0) this.positions.pop();
        if (this.lines.length > 0) this.featureGroup.removeLayer(this.lines.pop() as L.Polyline);
        if (this.rectangles.length > 0) this.featureGroup.removeLayer(this.rectangles.pop() as L.Rectangle);
    }

    removeAll(): void {
        while (this.positions.length > 0) this.positions.pop();
        while (this.rectangles.length > 0) this.featureGroup.removeLayer(this.rectangles.pop() as L.Rectangle);
        while (this.lines.length > 0) this.featureGroup.removeLayer(this.lines.pop() as L.Polyline);
    }

    private createPolyline(startPosition: Position, endPosition: Position): L.Polyline {
        return L.polyline(
            [
                startPosition.toCentreLatLng(this.map),
                endPosition.toCentreLatLng(this.map)
            ],
            { interactive: false } // modern Leaflet uses `interactive`, not `clickable`
        );
    }
}