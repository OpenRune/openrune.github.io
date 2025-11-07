'use strict';

import { Area } from './Area';
import * as L from 'leaflet';

export class Areas {
    map: L.Map;
    featureGroup: L.FeatureGroup;
    areas: Area[];
    rectangles: L.Rectangle[];

    constructor(map: L.Map) {
        this.map = map;
        this.featureGroup = new L.FeatureGroup();
        this.areas = [];
        this.rectangles = [];
    }

    add(area: Area): void {
        this.areas.push(area);
        const rectangle = area.toLeaflet(this.map);
        this.rectangles.push(rectangle);
        this.featureGroup.addLayer(rectangle);
    }

    removeLast(): void {
        if (this.areas.length > 0) {
            this.areas.pop();
            const lastRectangle = this.rectangles.pop();
            if (lastRectangle) {
                this.featureGroup.removeLayer(lastRectangle);
            }
        }
    }

    removeAll(): void {
        while (this.areas.length > 0) {
            this.areas.pop();
            const rectangle = this.rectangles.pop();
            if (rectangle) {
                this.featureGroup.removeLayer(rectangle);
            }
        }
    }
}