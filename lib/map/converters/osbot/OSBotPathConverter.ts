'use strict';

import { Position } from '../../model/Position';
import { Path } from '../../model/Path';
import { OSBotConverter } from '../osbot/OSBotConverter';

export class OSBotPathConverter extends OSBotConverter {
    javaArea!: string;
    javaPosition!: string;

    /*
    API Doc:
        https://osbot.org/api/org/osbot/rs07/api/map/Position.html
        Position(int x, int y, int z)
    */

    fromJava(text: string, path: Path): void {
        path.removeAll();
        text = text.replace(/\s/g, '');
        const posPattern = `new${this.javaPosition}\\((\\d+,\\d+,\\d)\\)`;
        const re = new RegExp(posPattern, "mg");

        let match: RegExpExecArray | null;
        while ((match = re.exec(text))) {
            const values = match[1].split(',').map(Number);
            path.add(new Position(values[0], values[1], values[2]));
        }
    }

    toRaw(path: Path): string {
        return path.positions.map(pos => `${pos.x},${pos.y},${pos.z}`).join('\n');
    }

    toJavaSingle(position: Position): string {
        return `${this.javaPosition} position = new ${this.javaPosition}(${position.x}, ${position.y}, ${position.z});`;
    }

    toJavaArray(path: Path): string {
        if (path.positions.length === 1) {
            return this.toJavaSingle(path.positions[0]);
        } else if (path.positions.length > 1) {
            const output = path.positions
                .map(pos => `    new ${this.javaPosition}(${pos.x}, ${pos.y}, ${pos.z})`)
                .join(',\n');
            return `${this.javaPosition}[] path = {\n${output}\n};`;
        }
        return '';
    }

    toJavaList(path: Path): string {
        if (path.positions.length === 1) {
            return this.toJavaSingle(path.positions[0]);
        } else if (path.positions.length > 1) {
            const output = path.positions
                .map(pos => `path.add(new ${this.javaPosition}(${pos.x}, ${pos.y}, ${pos.z}));`)
                .join('\n');
            return `List<${this.javaPosition}> path = new ArrayList<>();\n${output}`;
        }
        return '';
    }

    toJavaArraysAsList(path: Path): string {
        if (path.positions.length === 1) {
            return this.toJavaSingle(path.positions[0]);
        } else if (path.positions.length > 1) {
            const inner = path.positions
                .map(pos => `        new ${this.javaPosition}(${pos.x}, ${pos.y}, ${pos.z})`)
                .join(',\n');
            return `List<${this.javaPosition}> path = Arrays.asList(\n    new ${this.javaPosition}[]{\n${inner}\n    }\n);`;
        }
        return '';
    }
}