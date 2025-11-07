'use strict';

import { Area } from '../../model/Area';
import { Position } from '../../model/Position';
import { OSBotAreasConverter } from '../osbot/OSBotAreasConverter';
import { AABB } from './AABB';
import { RegionBox } from './RegionBox';
import { Areas } from '../../model/Areas';

type ParsedSections = {
    regionBoxes?: number[][];
    aabbs?: number[][];
    regions?: number[];
};

export class HD117AreasConverter extends OSBotAreasConverter {
    javaArea: string;
    javaPosition: string;

    constructor() {
        super();
        this.javaArea = "AABB";
        this.javaPosition = "AABB";
    }

    parseSections(jsonStrings: string | string[], keys: (keyof ParsedSections)[]): ParsedSections[] {
        const parsedSectionsArray: ParsedSections[] = [];

        if (!Array.isArray(jsonStrings)) {
            jsonStrings = [jsonStrings];
        }

        jsonStrings.forEach(jsonString => {
            const sections: ParsedSections = {};
            jsonString = jsonString.trim();
            try {
                const jsonObject = JSON.parse(jsonString);

                keys.forEach(key => {
                    if (Object.prototype.hasOwnProperty.call(jsonObject, key)) {
                        const value = jsonObject[key];
                        sections[key] = Array.isArray(value[0]) ? value : [value];
                    }
                });

                parsedSectionsArray.push(sections);
            } catch (error) {
                console.error('Error parsing JSON in parseSections:', error);
                console.error('JSON string:', jsonString);
                throw error;
            }
        });

        return parsedSectionsArray;
    }

    fromJava(text: string, areas: Areas): void {
        areas.removeAll();
        const keys: (keyof ParsedSections)[] = ["regionBoxes", "aabbs", "regions"];

        try {
            const formattedText = `{${text}}`;
            console.log('Converter formattedText:', formattedText.substring(0, 200));
            const parsedSections = this.parseSections(formattedText, keys);
            console.log('Converter parsedSections:', parsedSections);

            parsedSections.forEach(sections => {
                // Process aabbs
                if (sections.aabbs) {
                    sections.aabbs.forEach(aabb => {
                        let aabbData: AABB;
                        switch (aabb.length) {
                            case 4:
                                aabbData = new AABB(aabb[0], aabb[1], 0, aabb[2], aabb[3], 0);
                                break;
                            case 6:
                                aabbData = new AABB(aabb[0], aabb[1], aabb[2], aabb[3], aabb[4], aabb[5]);
                                break;
                            default:
                                console.log(`Unexpected format for AABB: ${aabb}`);
                                return;
                        }

                        areas.add(new Area(
                            new Position(aabbData.minX, aabbData.minY, aabbData.minZ),
                            new Position(aabbData.maxX, aabbData.maxY, aabbData.maxZ)
                        ));
                    });
                }

                // Process regions
                if (sections.regions) {
                    sections.regions.forEach(regionId => {
                        const regionData = new AABB(regionId);
                        areas.add(new Area(
                            new Position(regionData.minX, regionData.minY, regionData.minZ),
                            new Position(regionData.maxX, regionData.maxY, regionData.maxZ)
                        ));
                    });
                }

                // Process regionBoxes
                if (sections.regionBoxes) {
                    sections.regionBoxes.forEach(box => {
                        const [from, to] = box;
                        const regionBox = new RegionBox(from, to);
                        const aabb = regionBox.toAabb();

                        areas.add(new Area(
                            new Position(aabb.minX, aabb.minY, aabb.minZ),
                            new Position(aabb.maxX, aabb.maxY, aabb.maxZ)
                        ));
                    });
                }
            });

        } catch (error) {
            console.error('Error parsing or processing input:', error);
        }
    }

    toJavaArray(areas: Areas): string {
        if (areas.areas.length === 1) {
            const singleArea = this.toJavaSingle(areas.areas[0]);
            return `"aabbs": [\n    [ ${singleArea} ]\n]`;
        } else if (areas.areas.length > 1) {
            const aabbs = areas.areas.map(area => this.toJavaSingle(area));
            const formattedAABBs = aabbs.map(str => `    [ ${str} ]`).join(',\n');
            return `"aabbs": [\n${formattedAABBs}\n]`;
        }
        return "";
    }

    toJavaSingle(area: Area): string {
        const startX = Math.min(area.startPosition.x, area.endPosition.x);
        const endX = Math.max(area.startPosition.x, area.endPosition.x);
        const startY = Math.min(area.startPosition.y, area.endPosition.y);
        const endY = Math.max(area.startPosition.y, area.endPosition.y);
        const plane = area.startPosition.z;

        const values = plane > 0
            ? [startX, startY, plane, endX, endY, plane]
            : [startX, startY, endX, endY];

        return `[${values.join(', ')}]`;
    }
}