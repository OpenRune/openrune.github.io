'use strict';

import { Position } from '../../model/Position';
import { Path } from '../../model/Path';
import { OSBotPathConverter } from '../osbot/OSBotPathConverter';

export class DreamBotPathConverter extends OSBotPathConverter {
    javaArea: string;
    javaPosition: string;

    constructor() {
        super();
        this.javaArea = "Area";
        this.javaPosition = "Tile";
    }

    /**
     * Converts a Java path string into a Path object.
     * Supports DreamBot Tile(x, y) and Tile(x, y, z) constructors.
     * @param text Java code string
     * @param path Path object to populate
     */
    fromJava(text: string, path: Path): void {
        path.removeAll();
        text = text.replace(/\s/g, '');
        const posPattern = `new${this.javaPosition}\\((\\d+,\\d+(?:,\\d)?)\\)`;
        const re = new RegExp(posPattern, "mg");

        let match: RegExpExecArray | null;
        while ((match = re.exec(text))) {
            const values = match[1].split(',').map(Number);
            const z = values.length === 2 ? 0 : values[2];
            path.add(new Position(values[0], values[1], z));
        }
    }
}