'use strict';

import { Position } from './Position';
import * as L from 'leaflet';

export class Area {
    startPosition: Position;
    endPosition: Position;

    constructor(startPosition: Position, endPosition: Position) {
        this.startPosition = startPosition;
        this.endPosition = endPosition;
    }

    static fromBounds(map: L.Map, bounds: L.LatLngBounds): Area {
        return new Area(
            Position.fromLatLng(map, bounds.getSouthWest(),0),
            Position.fromLatLng(map, bounds.getNorthEast(),0)
        );
    }

    toLeaflet(map: L.Map): L.Rectangle {
        const newStartPosition = new Position(this.startPosition.x, this.startPosition.y, this.startPosition.z);
        const newEndPosition = new Position(this.endPosition.x, this.endPosition.y, this.startPosition.z);

        if (this.endPosition.x >= this.startPosition.x) {
            newEndPosition.x += 1;
        } else {
            newStartPosition.x += 1;
        }

        if (this.endPosition.y >= this.startPosition.y) {
            newEndPosition.y += 1;
        } else {
            newStartPosition.y += 1;
        }

        const rect = L.rectangle(
            L.latLngBounds(
                newStartPosition.toLatLng(map),
                newEndPosition.toLatLng(map)
            ), {
                color: "#33b5e5",
                weight: 1,
                interactive: false
            }
        );
        return rect;
    }

    getName(): string {
        return "Area";
    }
}