'use strict';

import { Area } from '../../model/Area';
import { Areas } from '../../model/Areas';
import { Position } from '../../model/Position';
import { OSBotConverter } from './OSBotConverter';

export class OSBotAreasConverter extends OSBotConverter {
    javaArea: string;
    javaPosition: string;

    constructor() {
        super();
        this.javaArea = '';
        this.javaPosition = '';
    }

    fromJava(text: string, areas: Areas): void {
        areas.removeAll();
        text = text.replace(/\s/g, '');
        const areasPattern = `(?:new${this.javaArea}\\((\\d+,\\d+,\\d+,\\d+)\\)|\\(new${this.javaPosition}\\((\\d+,\\d+,\\d)\\),new${this.javaPosition}\\((\\d+,\\d+,\\d)\\)\\))(?:.setPlane\\((\\d)\\))?`;
        const re = new RegExp(areasPattern, "mg");
        let match: RegExpExecArray | null;

        while ((match = re.exec(text))) {
            if (match[1] !== undefined) {
                const z = match[4] !== undefined ? parseInt(match[4], 10) : 0;
                const values = match[1].split(',').map(Number);
                areas.add(new Area(
                    new Position(values[0], values[1], z),
                    new Position(values[2], values[3], z)
                ));
            } else {
                const pos1Values = match[2].split(',').map(Number);
                const pos1Z = match[4] !== undefined ? parseInt(match[4], 10) : pos1Values[2];

                const pos2Values = match[3].split(',').map(Number);
                const pos2Z = match[4] !== undefined ? parseInt(match[4], 10) : pos2Values[2];

                areas.add(new Area(
                    new Position(pos1Values[0], pos1Values[1], pos1Z),
                    new Position(pos2Values[0], pos2Values[1], pos2Z)
                ));
            }
        }
    }

    toRaw(areas: Areas): string {
        return areas.areas.map(area => `${area.startPosition.x},${area.startPosition.y},${area.endPosition.x},${area.endPosition.y}`).join('\n');
    }

    toJavaSingle(area: Area): string {
        let areaDef = `new ${this.javaArea}(${area.startPosition.x}, ${area.startPosition.y}, ${area.endPosition.x}, ${area.endPosition.y})`;
        if (area.startPosition.z > 0) {
            areaDef += `.setPlane(${area.startPosition.z})`;
        }
        return areaDef;
    }

    toJavaArray(areas: Areas): string {
        if (areas.areas.length === 1) {
            return `${this.javaArea} area = ${this.toJavaSingle(areas.areas[0])};`;
        } else if (areas.areas.length > 1) {
            const output = areas.areas.map(area => `    ${this.toJavaSingle(area)}`).join(',\n');
            return `${this.javaArea}[] area = {\n${output}\n};`;
        }
        return '';
    }

    toJavaList(areas: Areas): string {
        if (areas.areas.length === 1) {
            return `${this.javaArea} area = ${this.toJavaSingle(areas.areas[0])};`;
        } else if (areas.areas.length > 1) {
            const output = areas.areas.map(area => `area.add(${this.toJavaSingle(area)});`).join('\n');
            return `List<${this.javaArea}> area = new ArrayList<>();\n${output}`;
        }
        return '';
    }

    toJavaArraysAsList(areas: Areas): string {
        if (areas.areas.length === 1) {
            return `${this.javaArea} area = ${this.toJavaSingle(areas.areas[0])};`;
        } else if (areas.areas.length > 1) {
            const inner = areas.areas.map(area => `        ${this.toJavaSingle(area)}`).join(',\n');
            return `List<${this.javaArea}> area = Arrays.asList(\n    new ${this.javaArea}[]{\n${inner}\n    }\n);`;
        }
        return '';
    }
}
