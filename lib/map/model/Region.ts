'use strict';

import { Position } from './Position';

export const MIN_X = 1024;
export const MAX_X = 4224;
export const MIN_Y = 1216;
export const MAX_Y = 12608;
export const REGION_WIDTH = 64;
export const REGION_HEIGHT = 64;

export class Region {
    readonly id: number;

    constructor(id: number) {
        this.id = id;
    }

    static fromPosition(position: Position): Region {
        return Region.fromCoordinates(position.x, position.y);
    }

    static fromCoordinates(x: number, y: number): Region {
        const regionID = (x >> 6) * 256 + (y >> 6);
        return new Region(regionID);
    }

    toCentrePosition(): Position {
        const position = this.toPosition();
        position.x += REGION_WIDTH / 2;
        position.y += REGION_HEIGHT / 2;
        return position;
    }

    toPosition(): Position {
        const x = (this.id >> 8) << 6;
        const y = (this.id & 0xFF) << 6;
        return new Position(x, y, 0);
    }
}
