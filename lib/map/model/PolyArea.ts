'use strict';

import { Position, RS_TILE_WIDTH_PX, RS_TILE_HEIGHT_PX } from './Position';
import * as L from 'leaflet';

export class PolyArea {
    map: L.Map;
    positions: Position[];
    polygon?: L.Polygon;
    featureGroup: L.FeatureGroup;

    constructor(map: L.Map) {
        this.map = map;
        this.positions = [];
        this.polygon = undefined;
        this.featureGroup = new L.FeatureGroup();
    }

    add(position: Position): void {
        this.positions.push(position);
        if (this.polygon) this.featureGroup.removeLayer(this.polygon);
        this.polygon = this.toLeaflet();
        this.featureGroup.addLayer(this.polygon);
    }

    addAll(positions: Position[]): void {
        this.positions.push(...positions);
        if (this.polygon) this.featureGroup.removeLayer(this.polygon);
        this.polygon = this.toLeaflet();
        this.featureGroup.addLayer(this.polygon);
    }

    removeLast(): void {
        if (this.positions.length > 0) {
            this.positions.pop();
            if (this.polygon) this.featureGroup.removeLayer(this.polygon);
        }

        if (this.positions.length === 0) {
            this.polygon = undefined;
        } else {
            this.polygon = this.toLeaflet();
            this.featureGroup.addLayer(this.polygon);
        }
    }

    removeAll(): void {
        this.positions = [];
        if (this.polygon) this.featureGroup.removeLayer(this.polygon);
        this.polygon = undefined;
    }

    isEmpty(): boolean {
        return this.positions.length === 0;
    }

    toLeaflet(): L.Polygon {
        const latLngs: L.LatLng[] = this.positions.map(pos => pos.toCentreLatLng(this.map));

        const maxZoom = this.map.getMaxZoom();
        for (let i = 0; i < latLngs.length; i++) {
            const point = this.map.project(latLngs[i], maxZoom);
            point.x -= RS_TILE_WIDTH_PX / 2;
            point.y += RS_TILE_HEIGHT_PX / 2;
            latLngs[i] = this.map.unproject(point, maxZoom);
        }

        const poly = L.polygon(latLngs, {
            color: "#33b5e5",
            weight: 1,
            interactive: false
        });
        return poly;
    }

    getName(): string {
        return "Area";
    }
}