'use strict';

import { Area } from '../../model/Area';
import { Areas } from '../../model/Areas';
import { Position } from '../../model/Position';
import { OSBotAreasConverter } from '../osbot/OSBotAreasConverter';

export class RuneLiteAreasConverter extends OSBotAreasConverter {
    constructor() {
        super();
        this.javaArea = "WorldArea";
        this.javaPosition = "WorldPoint";
    }

    fromJava(text: string, areas: Areas): void {
        areas.removeAll();
        text = text.replace(/\s/g, '');

        const areasPattern = `(?:new${this.javaArea}\\((\\d+,\\d+,\\d+,\\d+(?:,\\d+)?)\\)|\\(new${this.javaPosition}\\((\\d+,\\d+,\\d)\\),new${this.javaPosition}\\((\\d+,\\d+,\\d)\\)(?:,(\\d))?\\))`;
        const re = new RegExp(areasPattern, "mg");

        let match: RegExpExecArray | null;
        while ((match = re.exec(text))) {
            if (match[1] !== undefined) {
                const values = match[1].split(",").map(Number);

                const x = values[0];
                const y = values[1];
                const width = values[2];
                const height = values[3];
                const z = values[4] ?? 0;

                areas.add(new Area(
                    new Position(x, y + height - 1, z),
                    new Position(x + width - 1, y, z)
                ));
            } else {
                const pos1Values = match[2].split(",").map(Number);
                const pos1Z = match[4] !== undefined ? Number(match[4]) : pos1Values[2];

                const pos2Values = match[3].split(",").map(Number);
                const pos2Z = match[4] !== undefined ? Number(match[4]) : pos2Values[2];

                areas.add(new Area(
                    new Position(pos1Values[0], pos1Values[1], pos1Z),
                    new Position(pos2Values[0], pos2Values[1], pos2Z)
                ));
            }
        }
    }

    toJavaSingle(area: Area): string {
        const startX = Math.min(area.startPosition.x, area.endPosition.x);
        const startY = Math.min(area.startPosition.y, area.endPosition.y);
        const width = Math.abs(area.startPosition.x - area.endPosition.x) + 1;
        const height = Math.abs(area.startPosition.y - area.endPosition.y) + 1;
        const z = area.endPosition.z;

        return `new ${this.javaArea}(${startX}, ${startY}, ${width}, ${height}, ${z})`;
    }
}