'use strict';

import { DreamBotPathConverter } from '../dreambot/DreamBotPathConverter';

export class RuneLitePathConverter extends DreamBotPathConverter {
    javaArea: string;
    javaPosition: string;

    constructor() {
        super();
        this.javaArea = "WorldArea";
        this.javaPosition = "WorldPoint";
    }
}